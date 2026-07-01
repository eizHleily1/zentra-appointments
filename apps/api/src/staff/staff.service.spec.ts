import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { BUSINESS_REPOSITORY } from "../businesses/business.repository";
import { InMemoryBusinessRepository } from "../../test/in-memory-business.repository";
import { InMemoryStaffRepository } from "../../test/in-memory-staff.repository";
import { STAFF_REPOSITORY } from "./staff.repository";
import { StaffService } from "./staff.service";

describe("StaffService", () => {
  let businessRepository: InMemoryBusinessRepository;
  let service: StaffService;
  let staffRepository: InMemoryStaffRepository;

  beforeEach(async () => {
    businessRepository = new InMemoryBusinessRepository();
    staffRepository = new InMemoryStaffRepository();

    const moduleRef = await Test.createTestingModule({
      providers: [
        StaffService,
        {
          provide: BUSINESS_REPOSITORY,
          useValue: businessRepository
        },
        {
          provide: STAFF_REPOSITORY,
          useValue: staffRepository
        }
      ]
    }).compile();

    service = moduleRef.get(StaffService);
  });

  it("creates a staff member for a business member", async () => {
    const business = await createBusinessForUser(businessRepository, "owner-user");

    const staffMember = await service.createStaffMember({
      businessId: business.id,
      displayName: " Staff Member ",
      requesterUserId: "owner-user",
      userId: "staff-user"
    });

    expect(staffMember).toMatchObject({
      active: true,
      businessId: business.id,
      displayName: "Staff Member",
      userId: "staff-user"
    });
  });

  it("lists only staff for the requested business", async () => {
    const firstBusiness = await createBusinessForUser(businessRepository, "owner-user");
    const secondBusiness = await createBusinessForUser(businessRepository, "owner-user");
    const firstStaffMember = await service.createStaffMember({
      businessId: firstBusiness.id,
      displayName: "First Staff",
      requesterUserId: "owner-user",
      userId: "first-staff-user"
    });
    await service.createStaffMember({
      businessId: secondBusiness.id,
      displayName: "Second Staff",
      requesterUserId: "owner-user",
      userId: "second-staff-user"
    });

    await expect(service.findStaffMembersForBusiness(firstBusiness.id, "owner-user")).resolves.toEqual([
      firstStaffMember
    ]);
  });

  it("rejects users without business access", async () => {
    const business = await createBusinessForUser(businessRepository, "owner-user");

    await expect(
      service.createStaffMember({
        businessId: business.id,
        displayName: "Staff Member",
        requesterUserId: "other-user",
        userId: "staff-user"
      })
    ).rejects.toThrow(NotFoundException);
  });

  it("updates and deactivates a staff member without deleting it", async () => {
    const business = await createBusinessForUser(businessRepository, "owner-user");
    const staffMember = await service.createStaffMember({
      businessId: business.id,
      displayName: "Staff Member",
      requesterUserId: "owner-user",
      userId: "staff-user"
    });

    await expect(
      service.updateStaffMember({
        businessId: business.id,
        displayName: "Updated Staff",
        requesterUserId: "owner-user",
        staffMemberId: staffMember.id
      })
    ).resolves.toMatchObject({
      displayName: "Updated Staff"
    });

    await expect(service.deactivateStaffMember(business.id, staffMember.id, "owner-user")).resolves.toMatchObject({
      active: false
    });
    expect(staffRepository.getStaffMembers()).toHaveLength(1);
  });

  it("rejects duplicate staff users within the same business", async () => {
    const business = await createBusinessForUser(businessRepository, "owner-user");
    await service.createStaffMember({
      businessId: business.id,
      displayName: "Staff Member",
      requesterUserId: "owner-user",
      userId: "staff-user"
    });

    await expect(
      service.createStaffMember({
        businessId: business.id,
        displayName: "Duplicate Staff",
        requesterUserId: "owner-user",
        userId: "staff-user"
      })
    ).rejects.toThrow(ConflictException);
  });

  it("rejects whitespace-only display names", async () => {
    const business = await createBusinessForUser(businessRepository, "owner-user");

    await expect(
      service.createStaffMember({
        businessId: business.id,
        displayName: "   ",
        requesterUserId: "owner-user",
        userId: "staff-user"
      })
    ).rejects.toThrow(BadRequestException);
  });
});

async function createBusinessForUser(repository: InMemoryBusinessRepository, userId: string) {
  const result = await repository.createBusinessWithOwnerMembership({
    businessType: "BARBER",
    id: randomUUID(),
    initialOwnerUserId: userId,
    membershipId: randomUUID(),
    name: `${userId} Business`,
    timezone: "Asia/Amman"
  });

  return result.business;
}
