export const DEFAULT_REQUEST_ID_HEADER = 'x-request-id';
export const UNNAMED_CONTROLLER_NAME = 'unnamedController';
export const HTTP_METHODS = ['get', 'head', 'options', 'post', 'put', 'patch', 'delete'] as const;
export const APP_DEFAULT_PORT = 3030;

export const DEFAULT_JSON_PARSER_CONFIG = {
    limit: '10mb',
};

export const DEFAULT_URLENCODED_PARSER_CONFIG = {
    limit: '10mb',
    extended: false,
};
