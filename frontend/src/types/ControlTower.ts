export interface OcEvent {
    id: string;
    oc_id: string;
    description: string;
    start_date?: string;
    end_date?: string;
    status?: string;
    protocol?: string;
    status_options?: string[];
}

export interface FinancialRecord {
    id: string;
    invoiceNumber: string; // Obrigatório
    value?: number;
    issuanceDate?: string;
    approvalDate?: string;
    billingDate?: string;
    supplier?: string;
    paymentDate?: string;
    retention?: boolean; // Saldo retido: Sim/Não
    notes?: string;
}

export interface Oc {
    id: string;
    work_id: string;
    type: string;
    description: string;
    details?: string;
    value: number;
    status?: string;
    events?: OcEvent[];
    financial_records?: FinancialRecord[];
}

export interface ControlTowerWork {
    id: string;
    regional?: string;
    address?: {
        city?: string;
    };
}

export interface Alert {
    id: string;
    workId: string;
    eventFilter: string;
    recurrenceDays: number;
    recurrenceActive: boolean;
    leadTimeDays: number;
    leadTimeActive: boolean;
    createdAt: number;
}

export interface OcEventDefinition {
    id: string;
    description: string;
    default_status_options?: string[];
    // Add other fields as discovered or needed
    [key: string]: unknown; // Allow flexibility for now while strict on known fields
}
