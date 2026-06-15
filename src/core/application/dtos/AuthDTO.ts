export interface LoginDTO {
    email: string;
    password: string;
}

export interface LoginResponseDTO {
    token: string;
    expiresIn: string;
    user: {
        id: string;
        email: string;
        name: string;
        role: string;
    };
}

export interface VerifyTokenDTO {
    valid: boolean;
    userId?: string;
    email?: string;
}
