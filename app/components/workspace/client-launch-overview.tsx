"use client";

import type {WorkspaceModelV1} from "../../../lib/workspace/model";
import {ExecutiveOverview} from "./client-insights";
import {ClientDecisionRoute} from "./client-decision-route";

type Props = {
  model: WorkspaceModelV1;
  choose: (view: string) => void;
  retry: () => void;
};

function FreeOverview({model,choose,retry}: Props) {
  return <ExecutiveOverview model={model} choose={choose} retry={retry}/>;
}

export function ClientOverview(props: Props) {
  if (!props.model.full) return <FreeOverview {...props}/>;
  return <>
    <ExecutiveOverview {...props}>
      <ClientDecisionRoute model={props.model} choose={props.choose}/>
    </ExecutiveOverview>
  </>;
}
