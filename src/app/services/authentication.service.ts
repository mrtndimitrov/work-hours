import { Injectable } from '@angular/core';
import {
  Auth,
  authState,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from '@angular/fire/auth';
import { catchError, firstValueFrom, from, Observable } from 'rxjs';
import { MessageService } from 'primeng/api';
import { AppComponent } from '../app.component';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
  currentUser$ = authState(this.auth);

  constructor(private auth: Auth, private messageService: MessageService) {
    if (!environment.production) {
      connectAuthEmulator(auth, 'http://localhost:9099');
    }
  }

  async getCurrentUser() {
    return await firstValueFrom(this.currentUser$.pipe(map(async (user: any) => {
      return user;
    })));
  }

  login(email: string, password: string) {
    return from(signInWithEmailAndPassword(this.auth, email, password))
      .pipe(catchError((error: any) => {
        AppComponent.toggleProgressBar();
        console.error(error);
        this.messageService.add({
          severity: 'error',
          summary: 'Неуспешно автентикиране',
          detail: 'Моля проверете имейлът и паролата.',
          key: 'app-toast'
        });
        return new Observable();
      }));
  }

  logout() {
    return from(this.auth.signOut());
  }

  register(email: string, password: string) {
    return from(createUserWithEmailAndPassword(this.auth, email, password))
      .pipe(catchError((error: any) => {
        AppComponent.toggleProgressBar();
        console.error(error);
        this.messageService.add({
          severity: 'error',
          summary: 'Неуспешна регистрация',
          detail: 'Моля пробвайте пак.',
          key: 'app-toast'
        });
        return new Observable();
      }));
  }

  lostPassword(email: string) {
    return from(sendPasswordResetEmail(this.auth, email))
      .pipe(catchError((error: any) => {
        AppComponent.toggleProgressBar();
        console.error(error);
        this.messageService.add({
          severity: 'error',
          summary: 'Неуспешно изпратен имейл',
          detail: error.message,
          key: 'app-toast'
        });
        return new Observable();
      }));
  }
}
