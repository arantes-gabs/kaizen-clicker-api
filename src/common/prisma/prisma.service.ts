import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

function resolveDatabaseUrl(): string {
  const configuredUrl = process.env.DATABASE_URL?.trim();

  return configuredUrl && configuredUrl.length > 0
    ? configuredUrl
    : 'postgresql://kaizen:kaizen@localhost:5432/kaizen_clicker?schema=public';
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg(resolveDatabaseUrl()),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
