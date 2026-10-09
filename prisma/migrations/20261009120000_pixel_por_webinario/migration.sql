-- AlterTable
ALTER TABLE "public"."Webinar" ADD COLUMN     "metaPixelId" TEXT;

-- O webinario do Trader 360 usa o mesmo pixel da pagina de vendas
-- (trader360.tradernation.com.br). Nao faz nada se o endereco nao existir.
UPDATE "public"."Webinar" SET "metaPixelId" = '2870327729868266' WHERE "slug" = 'trader-360';
