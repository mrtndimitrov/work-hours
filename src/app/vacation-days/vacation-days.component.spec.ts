import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VacationDaysComponent } from './vacation-days.component';

describe('VacationDaysComponent', () => {
  let component: VacationDaysComponent;
  let fixture: ComponentFixture<VacationDaysComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ VacationDaysComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VacationDaysComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
