
import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GeminiService, FactCheckResult } from './services/gemini.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly geminiService = inject(GeminiService);

  claim = signal<string>('');
  result = signal<FactCheckResult | null>(null);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  copied = signal<boolean>(false);

  async verifyClaim(): Promise<void> {
    if (!this.claim().trim()) {
      this.error.set('Please enter a claim to verify.');
      return;
    }

    this.loading.set(true);
    this.result.set(null);
    this.error.set(null);

    try {
      const response = await this.geminiService.factCheck(this.claim());
      this.result.set(response);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
      this.error.set(errorMessage);
    } finally {
      this.loading.set(false);
    }
  }

  onClaimChange(value: string) {
    this.claim.set(value);
  }

  copyAnalysisToClipboard(analysisHtml: string): void {
    if (this.copied()) return;

    // Create a temporary element to parse the HTML and extract plain text
    const tempEl = document.createElement('div');
    tempEl.innerHTML = analysisHtml;
    const plainText = tempEl.textContent || tempEl.innerText || '';

    navigator.clipboard.writeText(plainText).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000); // Reset after 2 seconds
    }).catch(err => {
      console.error('Failed to copy analysis: ', err);
      this.error.set('Could not copy text to clipboard.');
    });
  }
}
