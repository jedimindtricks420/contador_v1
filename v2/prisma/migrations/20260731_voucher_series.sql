-- Non-destructive: adds a column with a default, existing vouchers keep all data (series defaults to 'CV2')
ALTER TABLE "Voucher" ADD COLUMN "series" TEXT NOT NULL DEFAULT 'CV2';
CREATE INDEX "Voucher_series_idx" ON "Voucher"("series");
