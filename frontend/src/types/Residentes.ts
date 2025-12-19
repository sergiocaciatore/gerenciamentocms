export interface ResidentEvaluation {
    technical: number;
    management: number;
    leadership: number;
    organization: number;
    commitment: number;
    communication: number;
}

export interface ResidentMetrics {
    technical: number;
    management: number;
    leadership: number;
    organization: number;
    commitment: number;
    communication: number;
    count: number;
}

export interface ResidentAssignment {
    id: string;
    name: string;
    contract_start: string;
    contract_end: string;
    evaluation?: ResidentEvaluation;
}

export interface ResidentWork {
    id: string;
    regional: string;
    site?: string;
    status?: string;
    residents?: ResidentAssignment[];
}

export interface Resident {
    id: string;
    name: string;
    email: string;
    crea: string;
    metrics?: ResidentMetrics;
}
