export interface DashboardWork {
    id: string;
    regional: string;
    site?: string;
    business_case?: string; // e.g., "R$ 1.000,00"
    go_live_date?: string;
}

export interface DashboardOC {
    work_id: string;
    description: string;
    value?: number;
}

export interface DashboardScheduleStage {
    name: string;
    start_planned?: string;
    end_planned?: string;
    start_real?: string;
    end_real?: string;
}

export interface DashboardPlanning {
    id: string;
    work_id: string;
    data?: {
        schedule?: DashboardScheduleStage[];
    };
}

export interface DashboardOccurrence {
    id: string;
    work_id: string;
    type: string;
    description: string;
    date: string;
}
