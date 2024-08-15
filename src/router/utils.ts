import {HTTP_METHODS, UNNAMED_CONTROLLER_NAME} from '../constants';
import {AppMiddleware, AppRouteHandler, HttpMethod} from '../types';

export function isAllowedMethod(method: string): method is HttpMethod | 'mount' {
    return HTTP_METHODS.includes(method as any) || method === 'mount';
}

export function wrapMiddleware(fn: AppMiddleware, i?: number): AppMiddleware {
    const result: AppMiddleware = async (req, res, next) => {
        const reqCtx = req.ctx;
        let ended = false;
        try {
            return await reqCtx.call(`${fn.name || `noname-${i}`} middleware`, async (ctx) => {
                req.ctx = ctx;
                return await fn(req, res, (...args: unknown[]) => {
                    req.ctx = reqCtx;
                    ended = true;
                    next(...args);
                });
            });
        } catch (error) {
            return next(error);
        } finally {
            if (!ended) {
                req.ctx = reqCtx;
            }
        }
    };
    Object.defineProperty(result, 'name', {value: fn.name});

    return result;
}

export function wrapRouteHandler(fn: AppRouteHandler, handlerName?: string) {
    const handlerNameLocal = handlerName || fn.name || UNNAMED_CONTROLLER_NAME;

    const handler: AppMiddleware = (req, res, next) => {
        req.ctx = req.originalContext.create(handlerNameLocal);
        if (req.routeInfo.handlerName !== handlerNameLocal) {
            if (req.routeInfo.handlerName === UNNAMED_CONTROLLER_NAME) {
                req.routeInfo.handlerName = handlerNameLocal;
            } else {
                req.routeInfo.handlerName = `${req.routeInfo.handlerName}(${handlerNameLocal})`;
            }
        }
        Promise.resolve(fn(req, res))
            .catch(next)
            .finally(() => {
                req.ctx.end();
                req.ctx = req.originalContext;
            });
    };

    Object.defineProperty(handler, 'name', {value: handlerNameLocal});

    return handler;
}
