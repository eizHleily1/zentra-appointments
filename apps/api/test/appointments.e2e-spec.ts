import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { APPOINTMENT_REPOSITORY } from "../src/appointments/appointment.repository";
import { PostgresAppointmentRepository } from "../src/appointments/postgres-appointment.repository";
import { AUTH_REPOSITORY } from "../src/auth/auth.repository";
import { PostgresAuthRepository } from "../src/auth/postgres-auth.repository";
import { BUSINESS_REPOSITORY } from "../src/businesses/business.repository";
import { PostgresBusinessRepository } from "../src/businesses/postgres-business.repository";
import { PostgresServiceRepository } from "../src/services/postgres-service.repository";
import { SERVICE_REPOSITORY } from "../src/services/service.repository";
import { PostgresStaffRepository } from "../src/staff/postgres-staff.repository";
import { STAFF_REPOSITORY } from "../src/staff/staff.repository";
import { InMemoryAppointmentRepository } from "./in-memory-appointment.repository";
import { InMemoryAuthRepository } from "./in-memory-auth.repository";
import { InMemoryBusinessRepository } from "./in-memory-business.repository";
import { InMemoryServiceRepository } from "./in-memory-service.repository";
import { InMemoryStaffRepository } from "./in-memory-staff.repository";

describe("AppointmentsController", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(APPOINTMENT_REPOSITORY)
      .useValue(new InMemoryAppointmentRepository())
      .overrideProvider(PostgresAppointmentRepository)
      .useValue({})
      .overrideProvider(AUTH_REPOSITORY)
      .useValue(new InMemoryAuthRepository())
      .overrideProvider(PostgresAuthRepository)
      .useValue({})
      .overrideProvider(BUSINESS_REPOSITORY)
      .useValue(new InMemoryBusinessRepository())
      .overrideProvider(PostgresBusinessRepository)
      .useValue({})
      .overrideProvider(SERVICE_REPOSITORY)
      .useValue(new InMemoryServiceRepository())
      .overrideProvider(PostgresServiceRepository)
      .useValue({})
      .overrideProvider(STAFF_REPOSITORY)
      .useValue(new InMemoryStaffRepository())
      .overrideProvider(PostgresStaffRepository)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true
      })
    );
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it("creates, lists, views, cancels, and completes appointments for a business member", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const client = await registerAndGetIdentity(app, "client@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);

    const appointment = await createAppointment(app, owner.accessToken, setup.business.id, {
      clientUserId: client.userId,
      endsAt: "2026-07-01T10:30:00.000Z",
      serviceId: setup.businessService.id,
      staffMemberId: setup.staffMember.id,
      startsAt: "2026-07-01T10:00:00.000Z"
    });

    expect(appointment).toMatchObject({
      businessId: setup.business.id,
      clientUserId: client.userId,
      serviceDurationMinutes: 30,
      serviceName: "Haircut",
      servicePrice: 15,
      staffDisplayName: "Staff Member",
      status: "BOOKED"
    });

    const listResponse = await request(app.getHttpServer())
      .get(`/businesses/${setup.business.id}/appointments`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].id).toBe(appointment.id);

    await request(app.getHttpServer())
      .get(`/businesses/${setup.business.id}/appointments/${appointment.id}`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    const cancelResponse = await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments/${appointment.id}/cancel`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(201);

    expect(cancelResponse.body.status).toBe("CANCELLED");

    const completeResponse = await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments/${appointment.id}/complete`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(201);

    expect(completeResponse.body.status).toBe("COMPLETED");
  });

  it("keeps appointment snapshots unchanged after service and staff updates", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const client = await registerAndGetIdentity(app, "client@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);
    const appointment = await createAppointment(app, owner.accessToken, setup.business.id, {
      clientUserId: client.userId,
      endsAt: "2026-07-01T10:30:00.000Z",
      serviceId: setup.businessService.id,
      staffMemberId: setup.staffMember.id,
      startsAt: "2026-07-01T10:00:00.000Z"
    });

    await request(app.getHttpServer())
      .patch(`/businesses/${setup.business.id}/services/${setup.businessService.id}`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ durationMinutes: 45, name: "Premium Haircut", price: 25 })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/businesses/${setup.business.id}/staff/${setup.staffMember.id}`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ displayName: "Updated Staff" })
      .expect(200);

    const detailsResponse = await request(app.getHttpServer())
      .get(`/businesses/${setup.business.id}/appointments/${appointment.id}`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(detailsResponse.body).toMatchObject({
      serviceDurationMinutes: 30,
      serviceName: "Haircut",
      servicePrice: 15,
      staffDisplayName: "Staff Member"
    });
  });

  it("rejects service and staff from a different business", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const client = await registerAndGetIdentity(app, "client@example.com");
    const firstStaffUser = await registerAndGetIdentity(app, "first-staff@example.com");
    const secondStaffUser = await registerAndGetIdentity(app, "second-staff@example.com");
    const firstSetup = await createBookableSetup(app, owner.accessToken, firstStaffUser.userId);
    const secondSetup = await createBookableSetup(app, owner.accessToken, secondStaffUser.userId);

    await request(app.getHttpServer())
      .post(`/businesses/${firstSetup.business.id}/appointments`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        clientUserId: client.userId,
        endsAt: "2026-07-01T10:30:00.000Z",
        serviceId: secondSetup.businessService.id,
        staffMemberId: firstSetup.staffMember.id,
        startsAt: "2026-07-01T10:00:00.000Z"
      })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/businesses/${firstSetup.business.id}/appointments`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        clientUserId: client.userId,
        endsAt: "2026-07-01T10:30:00.000Z",
        serviceId: firstSetup.businessService.id,
        staffMemberId: secondSetup.staffMember.id,
        startsAt: "2026-07-01T10:00:00.000Z"
      })
      .expect(404);
  });

  it("prevents users without business access from accessing or modifying appointments", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const other = await registerAndGetIdentity(app, "other@example.com");
    const client = await registerAndGetIdentity(app, "client@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);
    const appointment = await createAppointment(app, owner.accessToken, setup.business.id, {
      clientUserId: client.userId,
      endsAt: "2026-07-01T10:30:00.000Z",
      serviceId: setup.businessService.id,
      staffMemberId: setup.staffMember.id,
      startsAt: "2026-07-01T10:00:00.000Z"
    });

    await request(app.getHttpServer())
      .get(`/businesses/${setup.business.id}/appointments`)
      .set("authorization", `Bearer ${other.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments/${appointment.id}/cancel`)
      .set("authorization", `Bearer ${other.accessToken}`)
      .expect(404);
  });

  it("rejects unauthenticated creation, invalid input, and invalid time ranges", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const client = await registerAndGetIdentity(app, "client@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments`)
      .send({
        clientUserId: client.userId,
        endsAt: "2026-07-01T10:30:00.000Z",
        serviceId: setup.businessService.id,
        staffMemberId: setup.staffMember.id,
        startsAt: "2026-07-01T10:00:00.000Z"
      })
      .expect(401);

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        clientUserId: "not-a-uuid",
        endsAt: "not-a-date",
        serviceId: setup.businessService.id,
        staffMemberId: setup.staffMember.id,
        startsAt: "2026-07-01T10:00:00.000Z"
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        clientUserId: client.userId,
        endsAt: "2026-07-01T10:00:00.000Z",
        serviceId: setup.businessService.id,
        staffMemberId: setup.staffMember.id,
        startsAt: "2026-07-01T10:00:00.000Z"
      })
      .expect(400);
  });
});

async function registerAndGetIdentity(app: INestApplication, email: string): Promise<{ accessToken: string; userId: string }> {
  const response = await request(app.getHttpServer())
    .post("/auth/register")
    .set("x-forwarded-for", email)
    .send({ email, password: "strong-password" })
    .expect(201);

  return {
    accessToken: response.body.accessToken,
    userId: getSubjectFromJwt(response.body.accessToken)
  };
}

async function createBookableSetup(app: INestApplication, accessToken: string, staffUserId: string) {
  const business = await createBusiness(app, accessToken, `Business ${staffUserId}`);
  const businessService = await createService(app, accessToken, business.id);
  const staffMember = await createStaffMember(app, accessToken, business.id, staffUserId);

  return { business, businessService, staffMember };
}

async function createBusiness(app: INestApplication, accessToken: string, name: string) {
  const response = await request(app.getHttpServer())
    .post("/businesses")
    .set("authorization", `Bearer ${accessToken}`)
    .send({ businessType: "BARBER", name, timezone: "Asia/Amman" })
    .expect(201);

  return response.body;
}

async function createService(app: INestApplication, accessToken: string, businessId: string) {
  const response = await request(app.getHttpServer())
    .post(`/businesses/${businessId}/services`)
    .set("authorization", `Bearer ${accessToken}`)
    .send({ description: "Classic haircut", durationMinutes: 30, name: "Haircut", price: 15 })
    .expect(201);

  return response.body;
}

async function createStaffMember(app: INestApplication, accessToken: string, businessId: string, userId: string) {
  const response = await request(app.getHttpServer())
    .post(`/businesses/${businessId}/staff`)
    .set("authorization", `Bearer ${accessToken}`)
    .send({ displayName: "Staff Member", userId })
    .expect(201);

  return response.body;
}

async function createAppointment(
  app: INestApplication,
  accessToken: string,
  businessId: string,
  body: {
    clientUserId: string;
    endsAt: string;
    serviceId: string;
    staffMemberId: string;
    startsAt: string;
  }
) {
  const response = await request(app.getHttpServer())
    .post(`/businesses/${businessId}/appointments`)
    .set("authorization", `Bearer ${accessToken}`)
    .send(body)
    .expect(201);

  return response.body;
}

function getSubjectFromJwt(accessToken: string): string {
  const payload = accessToken.split(".")[1];
  const decodedPayload = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  return decodedPayload.sub;
}
