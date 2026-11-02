export const BenefitId = { Folders: 'folders', Files: 'files', Reuse: 'reuse' } as const;

export type BenefitId = (typeof BenefitId)[keyof typeof BenefitId];
