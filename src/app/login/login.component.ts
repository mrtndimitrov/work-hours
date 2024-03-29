import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { AuthenticationService } from '../services/authentication.service';
import { Router } from '@angular/router';
import { AppComponent } from '../app.component';
import { map } from 'rxjs/operators';
import { PasswordMatchValidator } from '../shared/helpers';
import { UsersService } from '../services/users.service';
import { MessageService } from 'primeng/api';
import {em} from "@fullcalendar/core/internal-common";

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  mode: string = 'login';
  loginForm: FormGroup = new FormGroup({
    'email': new FormControl('', [Validators.required, Validators.email]),
    'password': new FormControl('', Validators.required)
  });

  registerForm: FormGroup = new FormGroup({
    'email': new FormControl('', [Validators.required, Validators.email]),
    'password1': new FormControl('', Validators.required),
    'password2': new FormControl('', [])
  });

  lostPasswordForm: FormGroup = new FormGroup({
    'email': new FormControl('', [Validators.required, Validators.email])
  });

  constructor(public router: Router, private authService: AuthenticationService, private usersService: UsersService,
              private messageService: MessageService) {
    if (this.router.url.indexOf('register') !== -1) {
      this.mode = 'register';
    } else if (this.router.url.indexOf('lost-password') !== -1) {
      this.mode = 'lost-password';
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
    this.authService.register(email, password1).subscribe(async (e: any) => {
      await this.usersService.registerUser(e.user.uid, email);
      this.router.navigate(['/settings']);
    });
  }

  lostPassword() {
    if (this.lostPasswordForm.invalid) {
      return;
    }
    AppComponent.toggleProgressBar();
    const {email} = this.lostPasswordForm.value;
    this.authService.lostPassword(email).subscribe(() => {
      AppComponent.toggleProgressBar();
      this.messageService.add({severity:'success', summary:'Успешно изпратен имейл',
        detail:'Моля, отворете го за допълнителни инструкции', key: 'app-toast'});
      this.router.navigate(['/login']);
    });
  }
}
