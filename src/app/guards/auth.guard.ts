import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthenticationService } from '../services/authentication.service';
import { map } from 'rxjs/operators';
import { UsersService } from '../services/users.service';
import { OrganizationsService } from '../services/organizations.service';

@Injectable()
export class AuthGuard implements CanActivate {

  constructor(private router: Router, private authService: AuthenticationService,
              private usersService: UsersService, private organizationsService: OrganizationsService) { }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.authService.currentUser$.pipe(map((user: any) => {
      if (user) {
        return true;
      }
      this.organizationsService.invalidateCurrentOrganization();
      this.usersService.invalidateCurrentUser();
      this.router.navigateByUrl('/login');
      return false;
    }));
  }
}
