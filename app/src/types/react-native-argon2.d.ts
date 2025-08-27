declare module 'react-native-argon2' {
  export interface Argon2Options {
    iterations: number;
    memory: number;
    parallelism: number;
    hashLength: number;
    mode: 'argon2d' | 'argon2i' | 'argon2id';
  }

  export interface Argon2Result {
    rawHash: string;
    encodedHash: string;
  }

  const Argon2: {
    argon2: (
      password: string,
      salt: string,
      options: Argon2Options
    ) => Promise<Argon2Result>;
  };

  export default Argon2;
}
