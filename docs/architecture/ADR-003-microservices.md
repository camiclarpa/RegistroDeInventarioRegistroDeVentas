# ADR-003: Estrategia de Microservicios

## Estado
Aceptado

## Contexto
El sistema necesita escalar y tener despliegues independientes.

## Decisión
Implementar microservicios por bounded context con API Gateway.

## Servicios
- inventory-service (3003): Gestión de productos
- notification-service (3004): Notificaciones
- report-service (3005): Reportes y KPIs

## API Gateway
NGINX en puerto 8889 como punto de entrada único
