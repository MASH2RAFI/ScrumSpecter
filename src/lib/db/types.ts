// Keeps the Appwrite-style document shape the frontend was built around
export type Document = {
    $id: string;
    $createdAt: string;
    $updatedAt: string;
    // Appwrite documents were open-ended; populated fields (e.g. member name) rely on it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
};

type Row = { id: string; createdAt: Date; updatedAt: Date };

export const toDoc = <T extends Row>({ id, createdAt, updatedAt, ...rest }: T) => ({
    ...rest,
    $id: id,
    $createdAt: createdAt.toISOString(),
    $updatedAt: updatedAt.toISOString(),
});

export const toDocList = <T extends Row>(rows: T[]) => ({
    documents: rows.map(toDoc),
    total: rows.length,
});
