import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BusinessesModule } from "../businesses/businesses.module";
import { DatabaseModule } from "../database/database.module";
import { CLIENT_REPOSITORY } from "./client.repository";
import { ClientsController } from "./clients.controller";
import { ClientsService } from "./clients.service";
import { PostgresClientRepository } from "./postgres-client.repository";

@Module({
  controllers: [ClientsController],
  exports: [CLIENT_REPOSITORY, ClientsService],
  imports: [AuthModule, BusinessesModule, DatabaseModule],
  providers: [
    PostgresClientRepository,
    ClientsService,
    {
      provide: CLIENT_REPOSITORY,
      useExisting: PostgresClientRepository
    }
  ]
})
export class ClientsModule {}
