export class UsernameInUseError extends Error {
  constructor() {
    super('This username is already taken.');
    this.name = 'UsernameInUseError';
  }
}
