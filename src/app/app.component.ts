import { Component } from '@angular/core';
import {
  Event,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterEvent
} from '@angular/router';
import { filter } from 'rxjs';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from '@angular/fire/app-check';
import { initializeApp } from '@angular/fire/app';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  static showingProgressBar: boolean = false;
  title = 'work-hours';

  readonly AppComponent = AppComponent;

  constructor(private router: Router) {
    initializeAppCheck(initializeApp(environment.firebase), {
      provider: new ReCaptchaEnterpriseProvider(environment.recaptchaKey),
      isTokenAutoRefreshEnabled: true
    });

    this.router.events.pipe(
      filter((e: Event): e is RouterEvent => e instanceof RouterEvent)
    ).subscribe((e: RouterEvent) => {
      if (e instanceof NavigationStart) {
        AppComponent.showingProgressBar = true;
      }
      if (e instanceof NavigationEnd) {
        AppComponent.showingProgressBar = false;
      }
      // Set loading state to false in both of the below events to hide the spinner in case a request fails
      if (e instanceof NavigationCancel) {
        AppComponent.showingProgressBar = false;
      }
      if (e instanceof NavigationError) {
        AppComponent.showingProgressBar = false;
      }
    });
  }

  static toggleProgressBar() {
    AppComponent.showingProgressBar = !AppComponent.showingProgressBar;
  }
}
