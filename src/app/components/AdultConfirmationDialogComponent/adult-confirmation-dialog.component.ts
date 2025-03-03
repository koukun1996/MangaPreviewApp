import { Component, Inject, OnInit } from "@angular/core";
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-adult-confirmation-dialog",
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <div class="dialog-container">
      <h1 mat-dialog-title class="dialog-title">年齢確認</h1>
      <div mat-dialog-content class="dialog-content">
        <p>{{ data.message }}</p>
      </div>
      <div mat-dialog-actions class="dialog-actions">
        <button mat-raised-button color="primary" (click)="onConfirm()">はい</button>
        <button mat-button (click)="onCancel()">いいえ</button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      padding: 20px;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      z-index: 1000;
    }
    .dialog-title {
      font-size: 24px;
      color: #333;
      margin-bottom: 16px;
    }
    .dialog-content {
      font-size: 16px;
      margin-bottom: 24px;
    }
    .dialog-actions {
      display: flex;
      justify-content: space-between;
    }
  `]
})
export class AdultConfirmationDialogComponent implements OnInit {
  constructor(
    public dialogRef: MatDialogRef<AdultConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { message: string }
  ) {
    console.log('[DEBUG] AdultConfirmationDialogComponent constructor called with data:', data);
  }

  ngOnInit(): void {
    console.log('[DEBUG] AdultConfirmationDialogComponent initialized');
  }

  onConfirm(): void {
    console.log('[DEBUG] Adult confirmation dialog: User clicked YES');
    this.dialogRef.close(true);
  }

  onCancel(): void {
    console.log('[DEBUG] Adult confirmation dialog: User clicked NO');
    this.dialogRef.close(false);
  }
}
