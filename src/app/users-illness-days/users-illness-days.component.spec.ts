import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UsersIllnessDaysComponent } from './users-illness-days.component';

describe('UsersIllnessDaysComponent', () => {
  let component: UsersIllnessDaysComponent;
  let fixture: ComponentFixture<UsersIllnessDaysComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ UsersIllnessDaysComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UsersIllnessDaysComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
