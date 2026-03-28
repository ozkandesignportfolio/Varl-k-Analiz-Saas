import type { FormEvent } from "react";
import { BillingSubscriptionCreateForm } from "@/features/billing/components/billing-subscription-create-form";
import { BillingSubscriptionEditForm } from "@/features/billing/components/billing-subscription-edit-form";

export type BillingSubscriptionStatus = "active" | "paused" | "cancelled";
export type BillingCycle = "monthly" | "yearly";

export type BillingSubscriptionFormRuleOption = {
  id: string;
  title: string;
};

export type BillingSubscriptionFormValue = {
  maintenance_rule_id: string | null;
  provider_name: string;
  subscription_name: string;
  plan_name: string | null;
  billing_cycle: BillingCycle;
  amount: number;
  next_billing_date: string | null;
  auto_renew: boolean;
  status: BillingSubscriptionStatus;
  notes: string | null;
};

type BillingSubscriptionFormBaseProps = {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  inputClassName: string;
  maintenanceRules: BillingSubscriptionFormRuleOption[];
};

export type BillingSubscriptionCreateProps = BillingSubscriptionFormBaseProps & {
  mode: "create";
};

export type BillingSubscriptionEditProps = BillingSubscriptionFormBaseProps & {
  mode: "edit";
  subscription: BillingSubscriptionFormValue;
  onCancel: () => void;
};

type BillingSubscriptionFormProps =
  | BillingSubscriptionCreateProps
  | BillingSubscriptionEditProps;

export function BillingSubscriptionForm(props: BillingSubscriptionFormProps) {
  if (props.mode === "create") {
    return <BillingSubscriptionCreateForm {...props} />;
  }

  return <BillingSubscriptionEditForm {...props} />;
}
