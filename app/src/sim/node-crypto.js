// Browser stand-in for the one node:crypto function the controller's CommandBook uses.
export const randomUUID = () => crypto.randomUUID();
