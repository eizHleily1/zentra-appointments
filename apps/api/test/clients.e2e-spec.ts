import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { APPOINTMENT_REPOSITORY } from "../src/appointments/appointment.repository";
import { PostgresAppointmentRepository } from "../src/appointments/postgres-appointment.repository";
import { zonedLocalToUtc } from "../src/appointments/scheduling";
import { AUTH_REPOSITORY } from "../src/auth/auth.repository";
import { PostgresAuthRepository } from "../src/auth/postgres-auth.repository";
import { BUSINESS_HOURS_REPOSITORY } from "../src/businesses/business-hours.repository";
import { PostgresBusinessHoursRepository } from "../src/businesses/postgres-business-hours.repository";
import { BUSINESS_REPOSITORY } from "../src/businesses/business.repository";
import { PostgresBusinessRepository } from "../src/businesses/postgres-business.repository";
import { CLIENT_REPOSITORY } from "../src/clients/client.repository";
import { PostgresClientRepository } from "../src/clients/postgres-client.repository";
import { PostgresServiceRepository } from "../src/services/postgres-service.repository";
import { SERVICE_REPOSITORY } from "../src/services/service.repository";
import { PostgresStaffRepository } from "../src/staff/postgres-staff.repository";
import { STAFF_REPOSITORY } from "../src/staff/staff.repository";
import { InMemoryAppointmentRepository } from "./in-memory-appointment.repository";
import { InMemoryAuthRepository } from "./in-memory-auth.repository";
import { InMemoryBusinessHoursRepository } from "./in-memory-business-hours.repository";
import { InMemoryBusinessRepository } from "./in-memory-business.repository";
import { InMemoryClientRepository } from "./in-memory-client.repository";
import { InMemoryServiceRepository } from "./in-memory-service.repository";
import { InMemoryStaffRepository } from "./in-memory-staff.repository";

const TEST_DATE = "2030-07-02";

describe("ClientsController", () => {
  let app: INestApplication;
  let clientRepository: InMemoryClientRepository;

  beforeEach(async () => {
    clientRepository = new InMemoryClientRepository();

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
      .overrideProvider(BUSINESS_HOURS_REPOSITORY)
      .useValue(new InMemoryBusinessHoursRepository())
      .overrideProvider(PostgresBusinessHoursRepository)
      .useValue({})
      .overrideProvider(SERVICE_REPOSITORY)
      .useValue(new InMemoryServiceRepository())
      .overrideProvider(PostgresServiceRepository)
      .useValue({})
      .overrideProvider(STAFF_REPOSITORY)
      .useValue(new InMemoryStaffRepository())
      .overrideProvider(PostgresStaffRepository)
      .useValue({})
      .overrideProvider(CLIENT_REPOSITORY)
      .useValue(clientRepository)
      .overrideProvider(PostgresClientRepository)
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

  it("creates, lists, searches, updates, and deactivates clients for a business member", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const business = await createBusiness(app, owner.accessToken, "Owner Business");
    const client = await createClient(app, owner.accessToken, business.id, {
      displayName: "Maria Lopez",
      email: "maria@example.com",
      phoneNumber: "+1 555-123-4567"
    });

    expect(client).toMatchObject({
      active: true,
      businessId: business.id,
      displayName: "Maria Lopez",
      email: "maria@example.com",
      linkedUserId: null,
      phoneNumber: "+1 555-123-4567"
    });

    const listResponse = await request(app.getHttpServer())
      .get(`/businesses/${business.id}/clients`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(listResponse.body).toHaveLength(1);

    const searchResponse = await request(app.getHttpServer())
      .get(`/businesses/${business.id}/clients`)
      .query({ search: "555123" })
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(searchResponse.body).toHaveLength(1);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/businesses/${business.id}/clients/${client.id}`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ displayName: "Maria L." })
      .expect(200);

    expect(updateResponse.body.displayName).toBe("Maria L.");

    const deactivateResponse = await request(app.getHttpServer())
      .post(`/businesses/${business.id}/clients/${client.id}/deactivate`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(201);

    expect(deactivateResponse.body.active).toBe(false);
  });

  it("rejects duplicate active phone numbers within the same business", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const business = await createBusiness(app, owner.accessToken, "Owner Business");

    await createClient(app, owner.accessToken, business.id, {
      displayName: "Maria Lopez",
      phoneNumber: "555-123-4567"
    });

    await request(app.getHttpServer())
      .post(`/businesses/${business.id}/clients`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ displayName: "Maria L.", phoneNumber: "(555) 123-4567" })
      .expect(409);
  });

  it("allows duplicate names when no phone number is provided", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const business = await createBusiness(app, owner.accessToken, "Owner Business");

    await createClient(app, owner.accessToken, business.id, { displayName: "Walk-in Customer" });

    await request(app.getHttpServer())
      .post(`/businesses/${business.id}/clients`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ displayName: "Walk-in Customer" })
      .expect(201);
  });

  it("books appointments for existing and newly created clients with snapshot integrity", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);
    const existingClient = await createClient(app, owner.accessToken, setup.business.id, {
      displayName: "Maria Lopez",
      phoneNumber: "+1 555-123-4567"
    });
    const newClientResponse = await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/clients`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ displayName: "John Smith", phoneNumber: "+1 555-999-0000" })
      .expect(201);
    const newClient = newClientResponse.body;

    const existingClientAppointment = await createAppointment(app, owner.accessToken, setup.business.id, {
      clientId: existingClient.id,
      serviceId: setup.businessService.id,
      staffMemberId: setup.staffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:00")
    });
    const newClientAppointment = await createAppointment(app, owner.accessToken, setup.business.id, {
      clientId: newClient.id,
      serviceId: setup.businessService.id,
      staffMemberId: setup.staffMember.id,
      startTime: buildStartTime(TEST_DATE, "10:30")
    });

    expect(existingClientAppointment).toMatchObject({
      clientDisplayName: "Maria Lopez",
      clientId: existingClient.id,
      clientPhoneNumber: "+1 555-123-4567"
    });
    expect(newClientAppointment).toMatchObject({
      clientDisplayName: "John Smith",
      clientId: newClient.id,
      clientPhoneNumber: "+1 555-999-0000"
    });

    await request(app.getHttpServer())
      .patch(`/businesses/${setup.business.id}/clients/${existingClient.id}`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({ displayName: "Maria L.", phoneNumber: "+1 555-000-1111" })
      .expect(200);

    const detailsResponse = await request(app.getHttpServer())
      .get(`/businesses/${setup.business.id}/appointments/${existingClientAppointment.id}`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(200);

    expect(detailsResponse.body).toMatchObject({
      clientDisplayName: "Maria Lopez",
      clientPhoneNumber: "+1 555-123-4567"
    });
  });

  it("rejects booking inactive clients and keeps clients tenant-isolated", async () => {
    const owner = await registerAndGetIdentity(app, "owner@example.com");
    const other = await registerAndGetIdentity(app, "other@example.com");
    const staffUser = await registerAndGetIdentity(app, "staff@example.com");
    const firstBusiness = await createBusiness(app, owner.accessToken, "First Business");
    const secondBusiness = await createBusiness(app, owner.accessToken, "Second Business");
    const setup = await createBookableSetup(app, owner.accessToken, staffUser.userId);
    const client = await createClient(app, owner.accessToken, firstBusiness.id, {
      displayName: "Maria Lopez"
    });

    await request(app.getHttpServer())
      .get(`/businesses/${secondBusiness.id}/clients/${client.id}`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/businesses/${firstBusiness.id}/clients`)
      .set("authorization", `Bearer ${other.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/businesses/${firstBusiness.id}/clients/${client.id}/deactivate`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/businesses/${setup.business.id}/appointments`)
      .set("authorization", `Bearer ${owner.accessToken}`)
      .send({
        clientId: client.id,
        serviceId: setup.businessService.id,
        staffMemberId: setup.staffMember.id,
        startTime: buildStartTime(TEST_DATE, "10:00")
      })
      .expect(404);
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

async function createBusiness(app: INestApplication, accessToken: string, name: string) {
  const response = await request(app.getHttpServer())
    .post("/businesses")
    .set("authorization", `Bearer ${accessToken}`)
    .send({ businessType: "BARBER", name, timezone: "Asia/Amman" })
    .expect(201);

  return response.body;
}

async function createClient(
  app: INestApplication,
  accessToken: string,
  businessId: string,
  body: { displayName: string; email?: string; phoneNumber?: string }
) {
  const response = await request(app.getHttpServer())
    .post(`/businesses/${businessId}/clients`)
    .set("authorization", `Bearer ${accessToken}`)
    .send(body)
    .expect(201);

  return response.body;
}

async function createBookableSetup(
  app: INestApplication,
  accessToken: string,
  staffUserId: string,
  durationMinutes = 30,
  serviceName = "Haircut"
) {
  const business = await createBusiness(app, accessToken, `Business ${staffUserId}`);
  const businessService = await createService(app, accessToken, business.id, durationMinutes, serviceName);
  const staffMember = await createStaffMember(app, accessToken, business.id, staffUserId);

  return { business, businessService, staffMember };
}

async function createService(
  app: INestApplication,
  accessToken: string,
  businessId: string,
  durationMinutes: number,
  name: string
) {
  const response = await request(app.getHttpServer())
    .post(`/businesses/${businessId}/services`)
    .set("authorization", `Bearer ${accessToken}`)
    .send({ description: "Classic haircut", durationMinutes, name, price: 15 })
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
    clientId: string;
    serviceId: string;
    staffMemberId: string;
    startTime: string;
  }
) {
  const response = await request(app.getHttpServer())
    .post(`/businesses/${businessId}/appointments`)
    .set("authorization", `Bearer ${accessToken}`)
    .send(body)
    .expect(201);

  return response.body;
}

function buildStartTime(date: string, time: string): string {
  return zonedLocalToUtc(`${date}T${time}:00`, "Asia/Amman").toISOString();
}

function getSubjectFromJwt(accessToken: string): string {
  const payload = accessToken.split(".")[1];
  const decodedPayload = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  return decodedPayload.sub;
}
