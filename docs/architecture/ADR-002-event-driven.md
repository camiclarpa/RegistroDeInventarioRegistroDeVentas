# ADR-002: Event-Driven Architecture

## Estado
Aceptado

## Contexto
Necesitamos desacoplar los microservicios y manejar operaciones asíncronas.

## Decisión
Implementar Event-Driven Architecture con Redis Streams.

## Consecuencias
- Menor acoplamiento entre servicios
- Mejor resiliencia
- Consistencia eventual aceptable
- Mayor complejidad operacional

## Eventos implementados
- inventory.product.created
- inventory.stock.updated
- inventory.stock.low
- sale.created
- sale.completed
- sale.cancelled
