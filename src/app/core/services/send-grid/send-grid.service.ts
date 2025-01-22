import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class SendGridService {
  private readonly http = inject(HttpClient);

  // URL do funkcji serverless na Vercelu
  private readonly sendEmailUrl = 'https://ragnarok-155k4re14-marcintomkiewiczs-projects.vercel.app/api/send-email';

  sendEmail(to: string, subject: string, message: string): Observable<any> {
    const emailPayload = {
      to,
      subject,
      message,
    };

    // Wysyłamy dane do serverless function na Vercelu
    return this.http.post(this.sendEmailUrl, emailPayload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}
