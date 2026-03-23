alter table public.automation_events
  drop constraint if exists automation_events_trigger_type_check;

alter table public.automation_events
  add constraint automation_events_trigger_type_check
  check (
    trigger_type in (
      'warranty_30_days',
      'maintenance_7_days',
      'service_log_created',
      'subscription_due',
      'expense_threshold',
      'document_expiry_reminder'
    )
  );
