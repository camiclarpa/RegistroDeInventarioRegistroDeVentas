import { Request } from 'express';

export interface TypedRequest<T = unknown> extends Request {
    body: T;
    params: Record<string, string>;
    query: Record<string, string | undefined>;
    user?: {
        id: string;
        email: string;
        roleId: string;
    };
}

export interface TypedResponse<T = unknown> {
    json(body: T): this;
    status(code: number): this;
}
