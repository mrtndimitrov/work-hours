import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UsersVacationDaysComponent } from './users-vacation-days.component';

describe('UsersVacationDaysComponent', () => {
  let component: UsersVacationDaysComponent;
  let fixture: ComponentFixture<UsersVacationDaysComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UsersVacationDaysComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UsersVacationDaysComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
