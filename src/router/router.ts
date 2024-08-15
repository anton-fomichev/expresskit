import type {AppContext} from '@gravity-ui/nodekit';
import {Express} from 'express';

import {getAppPresets} from '../csp/middleware';
import {AppErrorHandler, AppRoutes, ExpressFinalError} from '../types';

import {setupObjectRoutes} from './object';
import {setupOpenAPIRoutes} from './openapi';

export function setupRoutes({
    ctx,
    expressApp,
    openAPIPath,
    routes,
}: {
    ctx: AppContext;
    expressApp: Express;
    openAPIPath?: string;
    routes?: AppRoutes;
}) {
    const appPresets = getAppPresets(ctx.config.expressCspPresets);

    if (openAPIPath) {
        setupOpenAPIRoutes({
            openAPIPath,
        });
    }

    // manually set routes are more important, they should override OpenAPI one's
    if (routes) {
        setupObjectRoutes({
            ctx,
            expressApp,
            routes,
            appPresets,
        });
    }

    if (ctx.config.appFinalErrorHandler) {
        const appFinalRequestHandler: AppErrorHandler = (error, req, res, next) =>
            Promise.resolve(ctx.config.appFinalErrorHandler?.(error, req, res, next)).catch(next);
        expressApp.use(appFinalRequestHandler);
    }

    const finalRequestHandler: AppErrorHandler = (error: ExpressFinalError, _, res, __) => {
        const errorDescription = 'Unhandled error during request processing';
        ctx.logError(errorDescription, error);
        const statusCode = (error && error.statusCode) || 500;
        res.status(statusCode).send(statusCode === 400 ? 'Bad request' : 'Internal server error');
    };

    expressApp.use(finalRequestHandler);
}
