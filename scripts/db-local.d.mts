export declare const PORT: number;
export declare function start(): string;
export declare function stop(): void;
export declare function fresh(db: string): string;
export declare function migrationFiles(): string[];
export declare const readSql: (path: string) => string;
