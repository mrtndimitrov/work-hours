import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IllnessDaysComponent } from './illness-days.component';

describe('IllnessDaysComponent', () => {
  let component: IllnessDaysComponent;
  let fixture: ComponentFixture<IllnessDaysComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ IllnessDaysComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IllnessDaysComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
