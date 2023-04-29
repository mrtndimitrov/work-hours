import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrganizationReportComponent } from './organization-report.component';

describe('OrganizationReportComponent', () => {
  let component: OrganizationReportComponent;
  let fixture: ComponentFixture<OrganizationReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ OrganizationReportComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrganizationReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
