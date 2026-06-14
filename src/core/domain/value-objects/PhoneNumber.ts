export class PhoneNumber {
  private constructor(private readonly value: string) {}

  static create(phone: string): PhoneNumber {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10 || cleaned.length > 15) {
      throw new Error(`Invalid phone number: ${phone}`);
    }
    return new PhoneNumber(cleaned);
  }

  getValue(): string {
    return this.value;
  }

  format(): string {
    // Formato básico: +57 300 1234567
    if (this.value.startsWith('57') && this.value.length === 12) {
      return `+${this.value.slice(0,2)} ${this.value.slice(2,5)} ${this.value.slice(5)}`;
    }
    return this.value;
  }
}
