import { Email } from '../../../src/core/domain/value-objects/Email';
import { SKU } from '../../../src/core/domain/value-objects/SKU';
import { Money } from '../../../src/core/domain/value-objects/Money';
import { PhoneNumber } from '../../../src/core/domain/value-objects/PhoneNumber';

describe('Value Objects', () => {
    test('Email debe validar formato correcto', () => {
        const email = Email.create('test@example.com');
        expect(email.getValue()).toBe('test@example.com');
    });
    
    test('Email debe rechazar formato inválido', () => {
        expect(() => Email.create('invalid-email')).toThrow();
    });
    
    test('SKU debe tener formato válido', () => {
        const sku = SKU.create('TEST-001');
        expect(sku.getValue()).toBe('TEST-001');
    });
    
    test('Money debe manejar operaciones', () => {
        const money1 = Money.create(100, 'COP');
        const money2 = Money.create(50, 'COP');
        const result = money1.add(money2);
        expect(result.getValue()).toBe(150);
    });
});
