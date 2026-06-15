export interface SendNotificationDTO {
    type: string;
    to: string;
    subject: string;
    message: string;
    priority?: 'low' | 'normal' | 'high';
}

export interface NotificationResponseDTO {
    id: string;
    type: string;
    to: string;
    subject: string;
    message: string;
    status: string;
    sentAt: Date;
}
