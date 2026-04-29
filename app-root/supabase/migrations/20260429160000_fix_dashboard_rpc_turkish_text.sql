-- Fix broken Turkish characters in dashboard RPC timeline events and status messages.
-- This migration replaces the get_dashboard_snapshot function with corrected Turkish text
-- and more descriptive/actionable status messages.

begin;

create or replace function public.get_dashboard_snapshot(
  p_user_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_from timestamptz := coalesce(p_from, now() - interval '29 days');
  v_to timestamptz := coalesce(p_to, now());
  v_period interval;
  v_prev_from timestamptz;
  v_prev_to timestamptz;
  v_today date;
  v_current_start_date date;
  v_current_end_date date;
  v_previous_start_date date;
  v_previous_end_date date;
  v_snapshot jsonb;
begin
  if v_to <= v_from then
    v_to := v_from + interval '1 day';
  end if;

  v_period := v_to - v_from;
  v_prev_to := v_from;
  v_prev_from := v_from - v_period;

  v_current_start_date := (v_from at time zone 'UTC')::date;
  v_current_end_date := (v_to at time zone 'UTC')::date;
  v_previous_start_date := (v_prev_from at time zone 'UTC')::date;
  v_previous_end_date := (v_prev_to at time zone 'UTC')::date;
  v_today := v_current_end_date - 1;

  with
    assets_agg as (
      select
        count(*)::int as assets_count,
        count(*) filter (where created_at >= v_from and created_at < v_to)::int as current_assets_created,
        count(*) filter (where created_at >= v_prev_from and created_at < v_prev_to)::int as previous_assets_created
      from public.assets
      where user_id = p_user_id
    ),
    rules_agg as (
      select
        count(*) filter (where is_active)::int as active_rules_count,
        count(*) filter (
          where is_active and created_at >= v_from and created_at < v_to
        )::int as current_rules_created,
        count(*) filter (
          where is_active and created_at >= v_prev_from and created_at < v_prev_to
        )::int as previous_rules_created
      from public.maintenance_rules
      where user_id = p_user_id
    ),
    documents_agg as (
      select
        count(*)::int as documents_count,
        coalesce(sum(file_size), 0)::numeric as documents_total_size,
        count(*) filter (where uploaded_at >= v_from and uploaded_at < v_to)::int as current_documents_uploaded,
        count(*) filter (where uploaded_at >= v_prev_from and uploaded_at < v_prev_to)::int as previous_documents_uploaded
      from public.documents
      where user_id = p_user_id
    ),
    documented_assets as (
      select count(distinct asset_id)::int as documented_asset_count
      from public.documents
      where user_id = p_user_id
        and asset_id is not null
    ),
    service_logs_agg as (
      select
        coalesce(sum(cost), 0)::numeric as total_cost,
        coalesce(sum(cost) filter (
          where service_date >= v_current_start_date and service_date < v_current_end_date
        ), 0)::numeric as current_service_cost,
        coalesce(sum(cost) filter (
          where service_date >= v_previous_start_date and service_date < v_previous_end_date
        ), 0)::numeric as previous_service_cost
      from public.service_logs
      where user_id = p_user_id
    ),
    subscriptions_agg as (
      select count(*)::int as subscriptions_count
      from public.billing_subscriptions
      where user_id = p_user_id
    ),
    invoices_agg as (
      select
        count(*)::int as invoices_count,
        coalesce(sum(total_amount), 0)::numeric as invoices_total_amount
      from public.billing_invoices
      where user_id = p_user_id
    ),
    overdue_maintenance as (
      select
        r.id::text as id,
        r.asset_id::text as asset_id,
        a.name as asset_name,
        r.title as rule_title,
        r.next_due_date::text as due_date,
        abs((r.next_due_date - v_today)::int) as day_count
      from public.maintenance_rules r
      join public.assets a
        on a.id = r.asset_id
       and a.user_id = p_user_id
      where r.user_id = p_user_id
        and r.is_active
        and r.next_due_date < v_today
      order by day_count desc, r.next_due_date asc
      limit 10
    ),
    upcoming_maintenance as (
      select
        r.id::text as id,
        r.asset_id::text as asset_id,
        a.name as asset_name,
        r.title as rule_title,
        r.next_due_date::text as due_date,
        (r.next_due_date - v_today)::int as day_count
      from public.maintenance_rules r
      join public.assets a
        on a.id = r.asset_id
       and a.user_id = p_user_id
      where r.user_id = p_user_id
        and r.is_active
        and r.next_due_date >= v_today
        and r.next_due_date <= (v_today + 7)
      order by day_count asc, r.next_due_date asc
      limit 10
    ),
    upcoming_warranty as (
      select
        a.id::text as id,
        a.id::text as asset_id,
        a.name as asset_name,
        a.warranty_end_date::text as warranty_end_date,
        (a.warranty_end_date - v_today)::int as days_remaining
      from public.assets a
      where a.user_id = p_user_id
        and a.warranty_end_date is not null
        and a.warranty_end_date >= v_today
        and a.warranty_end_date <= (v_today + 30)
      order by days_remaining asc, a.warranty_end_date asc
      limit 10
    ),
    upcoming_payments as (
      select
        i.id::text as id,
        i.invoice_no,
        coalesce(s.provider_name || ' - ' || s.subscription_name, 'Abonelik') as subscription_name,
        i.due_date::text as due_date,
        coalesce(i.total_amount, 0)::numeric as total_amount,
        i.status::text as status,
        (i.due_date - v_today)::int as days_remaining
      from public.billing_invoices i
      left join public.billing_subscriptions s
        on s.id = i.subscription_id
       and s.user_id = p_user_id
      where i.user_id = p_user_id
        and i.due_date is not null
        and i.status in ('pending', 'overdue')
        and i.due_date <= (v_today + 30)
      order by i.due_date asc, i.created_at asc
      limit 10
    ),
    missing_documents as (
      select
        a.id::text as id,
        a.id::text as asset_id,
        a.name as asset_name,
        a.created_at as created_at,
        greatest(0, (v_today - (a.created_at at time zone 'UTC')::date)::int) as days_without_document
      from public.assets a
      where a.user_id = p_user_id
        and not exists (
          select 1
          from public.documents d
          where d.user_id = p_user_id
            and d.asset_id = a.id
        )
      order by a.created_at asc
      limit 10
    ),
    timeline_events as (
      select *
      from (
        select
          ('service-' || sl.id::text) as id,
          'service'::text as event_type,
          'Servis kaydı eklendi'::text as title,
          (coalesce(a.name, 'Bilinmeyen Varlık') || ' – ' || sl.service_type)::text as description,
          sl.created_at as event_date,
          ('/services?asset=' || sl.asset_id::text)::text as href
        from public.service_logs sl
        left join public.assets a
          on a.id = sl.asset_id
         and a.user_id = p_user_id
        where sl.user_id = p_user_id
        order by sl.created_at desc
        limit 20
      ) service_events
      union all
      select *
      from (
        select
          ('document-' || d.id::text) as id,
          'document'::text as event_type,
          'Belge yüklendi'::text as title,
          (coalesce(a.name, 'Bilinmeyen Varlık') || ' – ' || d.file_name)::text as description,
          d.uploaded_at as event_date,
          ('/documents?asset=' || d.asset_id::text)::text as href
        from public.documents d
        left join public.assets a
          on a.id = d.asset_id
         and a.user_id = p_user_id
        where d.user_id = p_user_id
        order by d.uploaded_at desc
        limit 20
      ) document_events
      union all
      select *
      from (
        select
          ('rule-' || r.id::text) as id,
          'rule'::text as event_type,
          'Bakım kuralı oluşturuldu'::text as title,
          (coalesce(a.name, 'Bilinmeyen Varlık') || ' – ' || r.title)::text as description,
          r.created_at as event_date,
          ('/maintenance?asset=' || r.asset_id::text)::text as href
        from public.maintenance_rules r
        left join public.assets a
          on a.id = r.asset_id
         and a.user_id = p_user_id
        where r.user_id = p_user_id
        order by r.created_at desc
        limit 20
      ) rule_events
      union all
      select *
      from (
        select
          ('payment-' || i.id::text) as id,
          'payment'::text as event_type,
          'Ödeme işlendi'::text as title,
          (
            coalesce(s.provider_name || ' – ' || s.subscription_name, 'Abonelik')
            || ' – '
            || to_char(coalesce(i.total_amount, 0)::numeric, 'FM9999999999990.00')
            || ' TL'
          )::text as description,
          coalesce(i.paid_at::timestamptz, i.created_at) as event_date,
          '/invoices'::text as href
        from public.billing_invoices i
        left join public.billing_subscriptions s
          on s.id = i.subscription_id
         and s.user_id = p_user_id
        where i.user_id = p_user_id
          and i.status = 'paid'
          and i.paid_at is not null
        order by i.paid_at desc
        limit 20
      ) payment_events
    ),
    timeline_items as (
      select
        id,
        event_type,
        title,
        description,
        event_date,
        href
      from timeline_events
      order by event_date desc
      limit 20
    ),
    overdue_maintenance_all as (
      select count(*)::int as overdue_maintenance_count
      from public.maintenance_rules
      where user_id = p_user_id
        and is_active
        and next_due_date < v_today
    ),
    payment_counts as (
      select
        count(*) filter (where days_remaining < 0)::int as overdue_payment_count,
        count(*) filter (where days_remaining >= 0)::int as upcoming_payment_count
      from upcoming_payments
    ),
    status_inputs as (
      select
        a.assets_count,
        r.active_rules_count,
        d.documents_count,
        s.total_cost,
        da.documented_asset_count,
        oma.overdue_maintenance_count,
        pc.overdue_payment_count,
        pc.upcoming_payment_count,
        (select count(*)::int from upcoming_maintenance) as upcoming_maintenance_count,
        (select count(*)::int from upcoming_warranty) as upcoming_warranty_count,
        (select count(*)::int from missing_documents) as missing_documents_count
      from assets_agg a
      cross join rules_agg r
      cross join documents_agg d
      cross join service_logs_agg s
      cross join documented_assets da
      cross join overdue_maintenance_all oma
      cross join payment_counts pc
    ),
    status_json as (
      select
        case
          when (si.assets_count > 0 or si.active_rules_count > 0 or si.documents_count > 0 or si.total_cost > 0) = false then
            jsonb_build_object(
              'tone', 'stable',
              'headline', 'Stabil',
              'detail', 'Sistem durumu veri geldikçe otomatik güncellenecek.',
              'risk_count', 0,
              'risk', jsonb_build_object(
                'type', 'notification_prefs',
                'entity_id', null,
                'risk_key', 'notification_prefs:global'
              )
            )
          when si.overdue_maintenance_count > 0 then
            jsonb_build_object(
              'tone', 'critical',
              'headline', si.overdue_maintenance_count::text || ' gecikmiş bakım',
              'detail', 'Bakım takvimi planın gerisinde kaldı. Geciken bakımlar arıza riskini artırır ve onarım maliyetlerini yükseltebilir. Hemen aksiyon alın.',
              'risk_count', si.overdue_maintenance_count + si.overdue_payment_count + (si.upcoming_maintenance_count + si.upcoming_warranty_count + si.upcoming_payment_count + si.missing_documents_count),
              'risk', jsonb_build_object(
                'type', 'maintenance_due',
                'entity_id', null,
                'risk_key', 'maintenance_due:global'
              )
            )
          when si.overdue_payment_count > 0 then
            jsonb_build_object(
              'tone', 'critical',
              'headline', si.overdue_payment_count::text || ' gecikmiş ödeme',
              'detail', 'Vadesi geçmiş ödemeleriniz bulunuyor. Geciken ödemeler ek ücret veya hizmet kesintisine neden olabilir. Ödeme durumunu kontrol edin.',
              'risk_count', si.overdue_payment_count + (si.upcoming_maintenance_count + si.upcoming_warranty_count + si.upcoming_payment_count + si.missing_documents_count),
              'risk', jsonb_build_object(
                'type', 'invoice_due',
                'entity_id', null,
                'risk_key', 'invoice_due:global'
              )
            )
          when si.assets_count > 0 and si.active_rules_count = 0 then
            jsonb_build_object(
              'tone', 'warning',
              'headline', 'Bakım kuralı eksik',
              'detail', 'Varlıklarınız için henüz bakım kuralı tanımlanmamış. En az bir periyodik bakım kuralı oluşturarak arıza ve maliyet riskini azaltın.',
              'risk_count', greatest(1, si.upcoming_maintenance_count + si.upcoming_warranty_count + si.upcoming_payment_count + si.missing_documents_count),
              'risk', jsonb_build_object(
                'type', 'rule_missing',
                'entity_id', null,
                'risk_key', 'rule_missing:global'
              )
            )
          when (si.upcoming_maintenance_count + si.upcoming_warranty_count + si.upcoming_payment_count + si.missing_documents_count) > 0 then
            jsonb_build_object(
              'tone', 'warning',
              'headline', (si.upcoming_maintenance_count + si.upcoming_warranty_count + si.upcoming_payment_count + si.missing_documents_count)::text || ' dikkat gerektiren kayıt',
              'detail', 'Yaklaşan bakım, garanti, ödeme veya eksik belge kayıtları mevcut. Önleyici adım alarak olası sorunların önüne geçin.',
              'risk_count', si.upcoming_maintenance_count + si.upcoming_warranty_count + si.upcoming_payment_count + si.missing_documents_count,
              'risk', jsonb_build_object(
                'type',
                case
                  when si.missing_documents_count > 0 then 'document_missing'
                  when si.upcoming_payment_count > 0 then 'invoice_due'
                  else 'maintenance_due'
                end,
                'entity_id', null,
                'risk_key',
                case
                  when si.missing_documents_count > 0 then 'document_missing:global'
                  when si.upcoming_payment_count > 0 then 'invoice_due:global'
                  else 'maintenance_due:global'
                end
              )
            )
          else
            jsonb_build_object(
              'tone', 'healthy',
              'headline', 'Her şey yolunda',
              'detail', 'Kritik veya yaklaşan risk kaydı şu an bulunmuyor. Sisteminiz sağlıklı çalışıyor.',
              'risk_count', 0,
              'risk', jsonb_build_object(
                'type', 'notification_prefs',
                'entity_id', null,
                'risk_key', 'notification_prefs:global'
              )
            )
        end as payload
      from status_inputs si
    ),
    risk_panel_json as (
      select jsonb_build_object(
        'overdue_maintenance',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', id,
                'asset_id', asset_id,
                'asset_name', asset_name,
                'rule_title', rule_title,
                'due_date', due_date,
                'day_count', day_count
              )
              order by day_count desc, due_date asc
            )
            from overdue_maintenance
          ),
          '[]'::jsonb
        ),
        'upcoming_maintenance',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', id,
                'asset_id', asset_id,
                'asset_name', asset_name,
                'rule_title', rule_title,
                'due_date', due_date,
                'day_count', day_count
              )
              order by day_count asc, due_date asc
            )
            from upcoming_maintenance
          ),
          '[]'::jsonb
        ),
        'upcoming_warranty',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', id,
                'asset_id', asset_id,
                'asset_name', asset_name,
                'warranty_end_date', warranty_end_date,
                'days_remaining', days_remaining
              )
              order by days_remaining asc, warranty_end_date asc
            )
            from upcoming_warranty
          ),
          '[]'::jsonb
        ),
        'upcoming_payments',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', id,
                'invoice_no', invoice_no,
                'subscription_name', subscription_name,
                'due_date', due_date,
                'total_amount', total_amount,
                'status', status,
                'days_remaining', days_remaining
              )
              order by due_date asc
            )
            from upcoming_payments
          ),
          '[]'::jsonb
        ),
        'missing_documents',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', id,
                'asset_id', asset_id,
                'asset_name', asset_name,
                'created_at', created_at,
                'days_without_document', days_without_document
              )
              order by created_at asc
            )
            from missing_documents
          ),
          '[]'::jsonb
        )
      ) as payload
    ),
    timeline_json as (
      select
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', t.id,
              'type', t.event_type,
              'title', t.title,
              'description', t.description,
              'date', t.event_date,
              'href', t.href
            )
            order by t.event_date desc
          ),
          '[]'::jsonb
        ) as payload
      from timeline_items t
    )
  select jsonb_build_object(
    'counts',
    jsonb_build_object(
      'assets_count', a.assets_count,
      'documents_count', d.documents_count,
      'subscriptions_count', bs.subscriptions_count,
      'invoices_count', bi.invoices_count
    ),
    'sums',
    jsonb_build_object(
      'total_cost', sl.total_cost,
      'documents_total_size', d.documents_total_size,
      'invoices_total_amount', bi.invoices_total_amount
    ),
    'metrics',
    jsonb_build_object(
      'total_assets', a.assets_count,
      'active_rules', r.active_rules_count,
      'total_service_cost', sl.total_cost,
      'document_count', d.documents_count,
      'subscription_count', bs.subscriptions_count,
      'invoice_count', bi.invoices_count,
      'documented_asset_count', da.documented_asset_count
    ),
    'trends',
    jsonb_build_object(
      'total_assets', public.dashboard_build_trend(a.current_assets_created, a.previous_assets_created),
      'active_rules', public.dashboard_build_trend(r.current_rules_created, r.previous_rules_created),
      'total_service_cost', public.dashboard_build_trend(sl.current_service_cost, sl.previous_service_cost),
      'document_count', public.dashboard_build_trend(d.current_documents_uploaded, d.previous_documents_uploaded)
    ),
    'status',
    sj.payload,
    'risk_panel',
    rp.payload,
    'timeline',
    tj.payload
  )
  into v_snapshot
  from assets_agg a
  cross join rules_agg r
  cross join documents_agg d
  cross join documented_assets da
  cross join service_logs_agg sl
  cross join subscriptions_agg bs
  cross join invoices_agg bi
  cross join status_json sj
  cross join risk_panel_json rp
  cross join timeline_json tj;

  return coalesce(v_snapshot, '{}'::jsonb);
end;
$$;

commit;
