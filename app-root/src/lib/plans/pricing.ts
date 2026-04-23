export const PREMIUM_MONTHLY_PRICE_TL = 199.99;
export const PREMIUM_MONTHLY_PRICE_KURUS = Math.round(PREMIUM_MONTHLY_PRICE_TL * 100);

const TL_NUMBER_FORMATTER = new Intl.NumberFormat("tr-TR");

export const formatTl = (amount: number) => `${TL_NUMBER_FORMATTER.format(amount)} TL`;

export const PREMIUM_MONTHLY_PRICE_LABEL = formatTl(PREMIUM_MONTHLY_PRICE_TL);
