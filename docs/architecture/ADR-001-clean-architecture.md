# ADR-001: Adopción de Clean Architecture

## Estado
Aceptado

## Contexto
El sistema necesita ser mantenible, testeable y escalable. La arquitectura actual mezcla lógica de negocio con infraestructura.

## Decisión
Adoptar Clean Architecture con 3 capas: Domain, Application, Infrastructure.

## Consecuencias
- Domain no depende de frameworks externos
- Cambios en BD no afectan lógica de negocio
- Tests más fáciles de escribir
- Mayor código inicial

## Implementación
- Domain: Entidades, Value Objects, Repositorios (interfaces)
- Application: Servicios, Casos de uso
- Infrastructure: Implementaciones concretas (Prisma, Express)
