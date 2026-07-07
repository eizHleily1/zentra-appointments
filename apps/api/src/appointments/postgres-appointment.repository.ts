import { Injectable } from "@nestjs/common";

import { DatabaseService } from "../database/database.service";

import type { AppointmentStatus } from "./appointment-status";

import type { Appointment, AppointmentRepository, CreateAppointmentInput } from "./appointment.repository";



interface AppointmentRow {

  business_id: string;

  client_display_name: string;

  client_id: string;

  client_phone_number: string | null;

  created_at: Date;

  ends_at: Date;

  id: string;

  service_duration_minutes: number;

  service_id: string;

  service_name: string;

  service_price: string | null;

  staff_display_name: string;

  staff_member_id: string;

  starts_at: Date;

  status: AppointmentStatus;

  updated_at: Date;

}



@Injectable()

export class PostgresAppointmentRepository implements AppointmentRepository {

  constructor(private readonly databaseService: DatabaseService) {}



  async createAppointment(input: CreateAppointmentInput): Promise<Appointment> {

    const result = await this.databaseService.query<AppointmentRow>(

      `

        INSERT INTO appointments (

          id,

          business_id,

          client_id,

          client_display_name,

          client_phone_number,

          staff_member_id,

          service_id,

          starts_at,

          ends_at,

          status,

          service_name,

          service_duration_minutes,

          service_price,

          staff_display_name

        )

        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'BOOKED', $10, $11, $12, $13)

        RETURNING *

      `,

      [

        input.id,

        input.businessId,

        input.clientId,

        input.clientDisplayName,

        input.clientPhoneNumber,

        input.staffMemberId,

        input.serviceId,

        input.startsAt,

        input.endsAt,

        input.serviceName,

        input.serviceDurationMinutes,

        input.servicePrice,

        input.staffDisplayName

      ]

    );



    return mapAppointment(result.rows[0]);

  }



  async findAppointmentsForBusiness(businessId: string): Promise<Appointment[]> {

    const result = await this.databaseService.query<AppointmentRow>(

      "SELECT * FROM appointments WHERE business_id = $1 ORDER BY starts_at ASC, created_at ASC",

      [businessId]

    );



    return result.rows.map(mapAppointment);
  }

  async findAppointmentsForStaffMemberBetween(

    businessId: string,

    staffMemberId: string,

    rangeStart: Date,

    rangeEnd: Date

  ): Promise<Appointment[]> {

    const result = await this.databaseService.query<AppointmentRow>(

      `

        SELECT *

        FROM appointments

        WHERE business_id = $1

          AND staff_member_id = $2

          AND starts_at >= $3

          AND starts_at < $4

        ORDER BY starts_at ASC

      `,

      [businessId, staffMemberId, rangeStart, rangeEnd]

    );



    return result.rows.map(mapAppointment);

  }



  async findAppointmentByIdForBusiness(businessId: string, appointmentId: string): Promise<Appointment | null> {

    const result = await this.databaseService.query<AppointmentRow>(

      "SELECT * FROM appointments WHERE business_id = $1 AND id = $2 LIMIT 1",

      [businessId, appointmentId]

    );



    return result.rows[0] ? mapAppointment(result.rows[0]) : null;

  }



  async updateAppointmentStatus(

    businessId: string,

    appointmentId: string,

    status: AppointmentStatus

  ): Promise<Appointment | null> {

    const result = await this.databaseService.query<AppointmentRow>(

      `

        UPDATE appointments

        SET status = $3,

            updated_at = now()

        WHERE business_id = $1 AND id = $2

        RETURNING *

      `,

      [businessId, appointmentId, status]

    );



    return result.rows[0] ? mapAppointment(result.rows[0]) : null;

  }

}



function mapAppointment(row: AppointmentRow): Appointment {

  return {

    businessId: row.business_id,

    clientDisplayName: row.client_display_name,

    clientId: row.client_id,

    clientPhoneNumber: row.client_phone_number,

    createdAt: row.created_at,

    endsAt: row.ends_at,

    id: row.id,

    serviceDurationMinutes: row.service_duration_minutes,

    serviceId: row.service_id,

    serviceName: row.service_name,

    servicePrice: row.service_price === null ? null : Number(row.service_price),

    staffDisplayName: row.staff_display_name,

    staffMemberId: row.staff_member_id,

    startsAt: row.starts_at,

    status: row.status,

    updatedAt: row.updated_at

  };

}

