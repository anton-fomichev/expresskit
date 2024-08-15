import {AppContext} from '@gravity-ui/nodekit';
import {CSPPresetsArray} from 'csp-header';
import {Express, Router as createRouter} from 'express';

import {UNNAMED_CONTROLLER_NAME} from '../constants';
import {cspMiddleware} from '../csp/middleware';
import {
    AppMiddleware,
    AppMountDescription,
    AppRouteDescription,
    AppRoutes,
    AuthPolicy,
} from '../types';

import {isAllowedMethod, wrapMiddleware, wrapRouteHandler} from './utils';

export function setupObjectRoutes({
    ctx,
    expressApp,
    routes,
    appPresets,
}: {
    ctx: AppContext;
    expressApp: Express;
    routes: AppRoutes;
    appPresets: CSPPresetsArray;
}) {
    Object.entries(routes).forEach(([routeKey, rawRoute]) => {
        const routeKeyParts = routeKey.split(/\s+/);
        const method = routeKeyParts[0].toLowerCase();
        const routePath = routeKeyParts[1];

        if (!isAllowedMethod(method)) {
            throw new Error(`Unknown http method "${method}" for route "${routePath}"`);
        }

        const route: AppMountDescription | AppRouteDescription =
            typeof rawRoute === 'function' ? {handler: rawRoute} : rawRoute;

        const {
            authPolicy: routeAuthPolicy,
            handler: _h,
            beforeAuth: _beforeAuth,
            afterAuth: _afterAuth,
            cspPresets,
            ...restRouteInfo
        } = route;
        const authPolicy = routeAuthPolicy || ctx.config.appAuthPolicy || AuthPolicy.disabled;
        const handlerName =
            restRouteInfo.handlerName || route.handler.name || UNNAMED_CONTROLLER_NAME;
        const authHandler =
            authPolicy === AuthPolicy.disabled
                ? undefined
                : route.authHandler || ctx.config.appAuthHandler;

        const routeInfoMiddleware: AppMiddleware = function routeInfoMiddleware(req, res, next) {
            Object.assign(req.routeInfo, restRouteInfo, {authPolicy, handlerName});

            res.on('finish', () => {
                if (req.ctx.config.appTelemetryChEnableSelfStats) {
                    req.ctx.stats({
                        service: 'self',
                        action: req.routeInfo.handlerName || UNNAMED_CONTROLLER_NAME,
                        responseStatus: res.statusCode,
                        requestId: req.id,
                        requestTime: req.originalContext.getTime(), //We have to use req.originalContext here to get full time
                        requestMethod: req.method,
                        requestUrl: req.originalUrl,
                    });
                }
            });

            next();
        };

        const routeMiddlewares: AppMiddleware[] = [
            routeInfoMiddleware,
            ...(ctx.config.expressCspEnable
                ? [
                      cspMiddleware({
                          appPresets,
                          routPresets: cspPresets,
                          reportOnly: ctx.config.expressCspReportOnly,
                          reportTo: ctx.config.expressCspReportTo,
                          reportUri: ctx.config.expressCspReportUri,
                      }),
                  ]
                : []),
            ...(ctx.config.appBeforeAuthMiddleware || []),
            ...(ctx.config.appAfterAuthMiddleware || []),
            ...(route.beforeAuth || []),
            ...(route.afterAuth || []),
            ...(authHandler ? [authHandler] : []),
        ];

        const wrappedMiddleware = routeMiddlewares.map(wrapMiddleware);

        if (method === 'mount') {
            const router = createRouter({mergeParams: true});
            const targetApp = (route as AppMountDescription).handler({
                router,
                wrapRouteHandler,
            });
            expressApp.use(routePath, wrappedMiddleware, targetApp || router);
        } else {
            const handler = wrapRouteHandler((route as AppRouteDescription).handler, handlerName);
            expressApp[method](routePath, wrappedMiddleware, handler);
        }
    });
}
