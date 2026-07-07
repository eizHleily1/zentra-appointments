import { forwardRef, Module } from "@nestjs/common";
import { AppointmentsModule } from "../appointments/appointments.module";
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
  imports: [AuthModule, BusinessesModule, DatabaseModule, forwardRef(() => AppointmentsModule)],
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
