export type Lead = {
  id: string; companyName: string; companyInn: string; contactName: string; phone: string; email: string;
  activeSubscription?:string; updatedAt?:string; activeCount?:number; nextAction?:string|null; source: string; status: string; subscriptionStatus: string; paidFullOrders?: number; analysisId?: string | null; createdAt: string;
};
export type Application = {
  id: string; leadId: string; analysisId?: string; companyName: string; bank: string; product: string;
  createdAt?: string; updatedAt?: string; requestedAmount: number; calculatedLimit: number; status: string; nextAction: string;
};
export type CuratedAgent = { agentCode: string; name: string; agency: string; city: string; status: string; createdAt: string; clientsCount: number; activeSubscriptions: number; monthlyIncome: number };
export type OfferOption = { id: string; bank: string; product: string; kind: string };
export type AgentData = { pagination?:{page:number;limit:number;hasNext:boolean}; agent: { code: string; name: string; referralPath: string; isAdmin?: boolean }; modules?: { prospects?: boolean }; leads: Lead[]; applications: Application[]; offerOptions: OfferOption[]; applicationForecast: number; curator: { referralPath: string; agents: CuratedAgent[]; agentsCount: number; clientsCount: number; activeSubscriptions: number; monthlyIncome: number } };


export type AnalysisRef={id:string;companyName:string;companyInn:string;createdAt:string};
export type EventRow={id?:string;applicationId:string;companyName:string;status:string;createdAt:string};
export type DocumentRow={id:string;clientId:string;applicationId:string;fileName:string;companyName:string;category:string;status:string;uploadedBy:string;createdAt:string};
export type ApplicationEvent={id:string;fromStatus:string;toStatus:string;comment:string;createdAt:string};
export type AgentIdentity=Pick<AgentData,'agent'|'modules'|'offerOptions'>;
