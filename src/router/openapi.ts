import fs from 'fs';

import yaml from 'js-yaml';
import {Operation, Path, Spec} from 'swagger-schema-official';

import {isAllowedMethod} from './utils';

function handleParameters(parameters: Path['parameters']) {
    console.log(parameters);
}

function handleRef(ref: Path['$ref']) {
    console.log(ref);
}

function handleOperation(operation?: Operation) {
    console.log(operation);
}

function handleError({method, route}: {method: string; route: string}) {
    throw new Error(`Unknown http method "${method}" for route "${route}"`);
}

export function setupOpenAPIRoutes({openAPIPath}: {openAPIPath: string}) {
    const parsedOpenAPIEndpoints = yaml.load(fs.readFileSync(openAPIPath, 'utf8'), {
        schema: yaml.JSON_SCHEMA,
    }) as Spec;

    if (!parsedOpenAPIEndpoints) {
        throw new Error(`Failed when parsing ${openAPIPath}`);
    }

    if ('paths' in parsedOpenAPIEndpoints) {
        Object.entries(parsedOpenAPIEndpoints.paths).forEach(([pathName, path]) => {
            Object.entries(path).forEach(([key, value]) => {
                if (key === '$ref') {
                    handleRef(value);
                } else if (key === 'parameters') {
                    handleParameters(value);
                } else if (isAllowedMethod(key)) {
                    handleOperation(value);
                } else {
                    handleError({method: key, route: pathName});
                }
            });
        });
    }
}
