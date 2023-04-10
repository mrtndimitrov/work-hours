import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { AuthenticationService } from '../services/authentication.service';
import { Router } from '@angular/router';
import { AppComponent } from '../app.component';
import { map } from 'rxjs/operators';
import { PasswordMatchValidator } from '../shared/helpers';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  isLogin: boolean = true;
  loginForm: FormGroup = new FormGroup({
    'email': new FormControl('', [Validators.required, Validators.email]),
    'password': new FormControl('', Validators.required)
  });

  registerForm: FormGroup = new FormGroup({
    'email': new FormControl('', [Validators.required, Validators.email]),
    'password1': new FormControl('', Validators.required),
    'password2': new FormControl('', [])
  });

  constructor(public router: Router, private authService: AuthenticationService) {
    if (this.router.url.indexOf('register') !== -1) {
      this.isLogin = false;
    }
    this.registerForm.get('password2')!.setValidators([Validators.required, PasswordMatchValidator(this.registerForm)]);
  }

  ngOnInit() {
    this.authService.currentUser$.pipe(map((user: any) => {
      if (user) {
        this.router.navigateByUrl('/');
      }
    })).subscribe();
  }

  login() {
    if (this.loginForm.invalid) {
      return;
    }
    AppComponent.toggleProgressBar();
    const {email, password} = this.loginForm.value;
    this.authService.login(email, password).subscribe((e: any) => {
      this.router.navigate(['/']);
    });
  }

  register() {
    if (this.registerForm.invalid) {
      return;
    }
    AppComponent.toggleProgressBar();
    const {email, password1, password2} = this.registerForm.value;
    this.authService.register(email, password1).subscribe((e: any) => {
      this.router.navigate(['/settings']);
    });
  }
}
