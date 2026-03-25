export class PublicKeyInUseError extends Error {
  constructor() {
    super('This public key is already registered.');
    this.name = 'PublicKeyInUseError';
  }
}
