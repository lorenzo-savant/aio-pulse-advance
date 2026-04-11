export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      alert_events: {
        Row: {
          alert_rule_id: string
          brand_id: string | null
          channels_sent: string[] | null
          created_at: string
          data: Json
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          alert_rule_id: string
          brand_id?: string | null
          channels_sent?: string[] | null
          created_at?: string
          data?: Json
          id: string
          is_read?: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          alert_rule_id?: string
          brand_id?: string | null
          channels_sent?: string[] | null
          created_at?: string
          data?: Json
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      alert_rules: {
        Row: {
          brand_id: string | null
          channels: string[] | null
          condition: Json
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean
          last_fired_at: string | null
          name: string
          type: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          brand_id?: string | null
          channels?: string[] | null
          condition: Json
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id: string
          is_active?: boolean
          last_fired_at?: string | null
          name: string
          type: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          brand_id?: string | null
          channels?: string[] | null
          condition?: Json
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          last_fired_at?: string | null
          name?: string
          type?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      brand_health_scores: {
        Row: {
          avi_score: number
          brand_id: string | null
          citation_count: number
          citation_rate: number
          created_at: string
          date: string
          engine_breakdown: Json
          hallucination_rate: number
          health_score: number
          id: string
          mention_count: number
          mention_rate: number
          metadata: Json | null
          position_avg: number
          recommendation_rate: number
          sentiment_score: number
          user_id: string
          visibility_score: number
        }
        Insert: {
          avi_score?: number
          brand_id?: string | null
          citation_count?: number
          citation_rate?: number
          created_at?: string
          date?: string
          engine_breakdown?: Json
          hallucination_rate?: number
          health_score?: number
          id?: string
          mention_count?: number
          mention_rate?: number
          metadata?: Json | null
          position_avg?: number
          recommendation_rate?: number
          sentiment_score?: number
          user_id: string
          visibility_score?: number
        }
        Update: {
          avi_score?: number
          brand_id?: string | null
          citation_count?: number
          citation_rate?: number
          created_at?: string
          date?: string
          engine_breakdown?: Json
          hallucination_rate?: number
          health_score?: number
          id?: string
          mention_count?: number
          mention_rate?: number
          metadata?: Json | null
          position_avg?: number
          recommendation_rate?: number
          sentiment_score?: number
          user_id?: string
          visibility_score?: number
        }
        Relationships: []
      }
      brands: {
        Row: {
          alert_email: string | null
          aliases: string[] | null
          color: string | null
          competitors: string[] | null
          created_at: string | null
          description: string | null
          domain: string | null
          domains: string[] | null
          email: string | null
          id: string
          industry: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string
          report_brand_name: string | null
          report_logo_url: string | null
          report_primary_color: string | null
          slug: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alert_email?: string | null
          aliases?: string[] | null
          color?: string | null
          competitors?: string[] | null
          created_at?: string | null
          description?: string | null
          domain?: string | null
          domains?: string[] | null
          email?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          report_brand_name?: string | null
          report_logo_url?: string | null
          report_primary_color?: string | null
          slug: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alert_email?: string | null
          aliases?: string[] | null
          color?: string | null
          competitors?: string[] | null
          created_at?: string | null
          description?: string | null
          domain?: string | null
          domains?: string[] | null
          email?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          report_brand_name?: string | null
          report_logo_url?: string | null
          report_primary_color?: string | null
          slug?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      citation_snapshots: {
        Row: {
          avg_position: number | null
          avg_sentiment: number | null
          avg_visibility: number | null
          brand_citations: number | null
          brand_id: string | null
          category: string
          citation_rate: number | null
          competitor_rates: Json | null
          created_at: string | null
          engine: string
          id: string
          language: string
          project_id: string
          scan_date: string
          total_prompts: number | null
          user_id: string | null
        }
        Insert: {
          avg_position?: number | null
          avg_sentiment?: number | null
          avg_visibility?: number | null
          brand_citations?: number | null
          brand_id?: string | null
          category?: string
          citation_rate?: number | null
          competitor_rates?: Json | null
          created_at?: string | null
          engine?: string
          id?: string
          language?: string
          project_id: string
          scan_date: string
          total_prompts?: number | null
          user_id?: string | null
        }
        Update: {
          avg_position?: number | null
          avg_sentiment?: number | null
          avg_visibility?: number | null
          brand_citations?: number | null
          brand_id?: string | null
          category?: string
          citation_rate?: number | null
          competitor_rates?: Json | null
          created_at?: string | null
          engine?: string
          id?: string
          language?: string
          project_id?: string
          scan_date?: string
          total_prompts?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      competitor_analyses: {
        Row: {
          brand_id: string | null
          competitors: Json | null
          created_at: string | null
          id: string
          primary_url: string
          raw_response: Json | null
          summary: string | null
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          competitors?: Json | null
          created_at?: string | null
          id?: string
          primary_url: string
          raw_response?: Json | null
          summary?: string | null
          user_id?: string
        }
        Update: {
          brand_id?: string | null
          competitors?: Json | null
          created_at?: string | null
          id?: string
          primary_url?: string
          raw_response?: Json | null
          summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      keyword_tracking: {
        Row: {
          avg_position: number | null
          brand_id: string | null
          category: string | null
          correlation_score: number | null
          created_at: string | null
          engines: string[] | null
          id: string
          is_active: boolean | null
          keyword: string
          language: string | null
          market: string | null
          mention_count: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avg_position?: number | null
          brand_id?: string | null
          category?: string | null
          correlation_score?: number | null
          created_at?: string | null
          engines?: string[] | null
          id?: string
          is_active?: boolean | null
          keyword: string
          language?: string | null
          market?: string | null
          mention_count?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avg_position?: number | null
          brand_id?: string | null
          category?: string | null
          correlation_score?: number | null
          created_at?: string | null
          engines?: string[] | null
          id?: string
          is_active?: boolean | null
          keyword?: string
          language?: string | null
          market?: string | null
          mention_count?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      monitoring_results: {
        Row: {
          all_providers: string[] | null
          brand_id: string
          brand_mentioned: boolean | null
          cited_urls: string[] | null
          competitor_mentions: Json | null
          cost_credits: number | null
          created_at: string | null
          engine: string
          execution_time_ms: number | null
          failed_providers: string[] | null
          hallucination_flags: Json | null
          has_hallucination: boolean | null
          id: string
          mention_count: number | null
          mention_position: number | null
          mention_type: string | null
          primary_provider: string | null
          prompt_id: string
          prompt_text: string | null
          query_text: string | null
          raw_response: Json | null
          response_comparison: Json | null
          response_text: string | null
          sentiment: string | null
          sentiment_score: number | null
          url: string | null
          user_id: string
          visibility_score: number | null
        }
        Insert: {
          all_providers?: string[] | null
          brand_id: string
          brand_mentioned?: boolean | null
          cited_urls?: string[] | null
          competitor_mentions?: Json | null
          cost_credits?: number | null
          created_at?: string | null
          engine: string
          execution_time_ms?: number | null
          failed_providers?: string[] | null
          hallucination_flags?: Json | null
          has_hallucination?: boolean | null
          id?: string
          mention_count?: number | null
          mention_position?: number | null
          mention_type?: string | null
          primary_provider?: string | null
          prompt_id: string
          prompt_text?: string | null
          query_text?: string | null
          raw_response?: Json | null
          response_comparison?: Json | null
          response_text?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          url?: string | null
          user_id: string
          visibility_score?: number | null
        }
        Update: {
          all_providers?: string[] | null
          brand_id?: string
          brand_mentioned?: boolean | null
          cited_urls?: string[] | null
          competitor_mentions?: Json | null
          cost_credits?: number | null
          created_at?: string | null
          engine?: string
          execution_time_ms?: number | null
          failed_providers?: string[] | null
          hallucination_flags?: Json | null
          has_hallucination?: boolean | null
          id?: string
          mention_count?: number | null
          mention_position?: number | null
          mention_type?: string | null
          primary_provider?: string | null
          prompt_id?: string
          prompt_text?: string | null
          query_text?: string | null
          raw_response?: Json | null
          response_comparison?: Json | null
          response_text?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          url?: string | null
          user_id?: string
          visibility_score?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      prompts: {
        Row: {
          brand_id: string
          category: string | null
          created_at: string | null
          engines: string[] | null
          id: string
          is_active: boolean | null
          language: string | null
          last_run_at: string | null
          market: string | null
          run_frequency: string | null
          text: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          brand_id: string
          category?: string | null
          created_at?: string | null
          engines?: string[] | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          last_run_at?: string | null
          market?: string | null
          run_frequency?: string | null
          text: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          brand_id?: string
          category?: string | null
          created_at?: string | null
          engines?: string[] | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          last_run_at?: string | null
          market?: string | null
          run_frequency?: string | null
          text?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          organization_id: string | null
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_sub_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id: string
          organization_id?: string | null
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_sub_id?: string | null
          updated_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          organization_id?: string | null
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_sub_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          brand_id: string
          created_at: string | null
          email: string
          id: string
          role: string
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          email: string
          id?: string
          role?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          email?: string
          id?: string
          role?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          created_at: string | null
          encrypted_key: string
          id: string
          is_active: boolean | null
          label: string | null
          last_used_at: string | null
          provider: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          encrypted_key: string
          id?: string
          is_active?: boolean | null
          label?: string | null
          last_used_at?: string | null
          provider: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          encrypted_key?: string
          id?: string
          is_active?: boolean | null
          label?: string | null
          last_used_at?: string | null
          provider?: string
          user_id?: string | null
        }
        Relationships: []
      }
      recommendation_tracking: {
        Row: {
          id: string
          brand_id: string
          category: string | null
          priority: string | null
          recommendation_text: string
          source: string | null
          first_seen_date: string | null
          last_seen_date: string | null
          occurrence_count: number
          implementation_status: string
          implementation_completion_date: string | null
          notes: string | null
          status: string
          user_last_updated_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          brand_id: string
          category?: string | null
          priority?: string | null
          recommendation_text: string
          source?: string | null
          first_seen_date?: string | null
          last_seen_date?: string | null
          occurrence_count?: number
          implementation_status?: string
          implementation_completion_date?: string | null
          notes?: string | null
          status?: string
          user_last_updated_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          brand_id?: string
          category?: string | null
          priority?: string | null
          recommendation_text?: string
          source?: string | null
          first_seen_date?: string | null
          last_seen_date?: string | null
          occurrence_count?: number
          implementation_status?: string
          implementation_completion_date?: string | null
          notes?: string | null
          status?: string
          user_last_updated_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      research_archives: {
        Row: {
          id: string
          brand_id: string
          query_type: string
          tool_section: string | null
          query_text: string | null
          query_date: string | null
          ai_model_used: string | null
          response_text: string | null
          metadata: Json | null
          status: string
          deleted_at: string | null
          created_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          brand_id: string
          query_type: string
          tool_section?: string | null
          query_text?: string | null
          query_date?: string | null
          ai_model_used?: string | null
          response_text?: string | null
          metadata?: Json | null
          status?: string
          deleted_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          brand_id?: string
          query_type?: string
          tool_section?: string | null
          query_text?: string | null
          query_date?: string | null
          ai_model_used?: string | null
          response_text?: string | null
          metadata?: Json | null
          status?: string
          deleted_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sentiment_history: {
        Row: {
          id: string
          brand_id: string
          snapshot_date: string
          sentiment_score: number
          positive_count: number
          neutral_count: number
          negative_count: number
          total_mentions: number
          top_positive_topics: Json | null
          top_negative_topics: Json | null
          metadata: Json | null
          deleted_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          brand_id: string
          snapshot_date: string
          sentiment_score?: number
          positive_count?: number
          neutral_count?: number
          negative_count?: number
          total_mentions?: number
          top_positive_topics?: Json | null
          top_negative_topics?: Json | null
          metadata?: Json | null
          deleted_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          brand_id?: string
          snapshot_date?: string
          sentiment_score?: number
          positive_count?: number
          neutral_count?: number
          negative_count?: number
          total_mentions?: number
          top_positive_topics?: Json | null
          top_negative_topics?: Json | null
          metadata?: Json | null
          deleted_at?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      workflow_executions: {
        Row: {
          id: string
          workflow_type: string
          brand_id: string | null
          prompt_id: string | null
          user_id: string | null
          status: string
          steps: Json
          error: string | null
          metadata: Json
          started_at: string | null
          completed_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          workflow_type: string
          brand_id?: string | null
          prompt_id?: string | null
          user_id?: string | null
          status?: string
          steps?: Json
          error?: string | null
          metadata?: Json
          started_at?: string | null
          completed_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          workflow_type?: string
          brand_id?: string | null
          prompt_id?: string | null
          user_id?: string | null
          status?: string
          steps?: Json
          error?: string | null
          metadata?: Json
          started_at?: string | null
          completed_at?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      recommendation_history: {
        Row: {
          based_on_count: number | null
          based_on_data: Json | null
          brand_id: string
          created_at: string | null
          description: string | null
          id: string
          implementation: Json | null
          recommendations: Json | null
          summary: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          based_on_count?: number | null
          based_on_data?: Json | null
          brand_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          implementation?: Json | null
          recommendations?: Json | null
          summary?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          based_on_count?: number | null
          based_on_data?: Json | null
          brand_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          implementation?: Json | null
          recommendations?: Json | null
          summary?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      brand_invitations: {
        Row: {
          id: string
          brand_id: string
          email: string
          role: string
          invited_by: string | null
          token: string
          status: string
          expires_at: string
          created_at: string | null
        }
        Insert: {
          id?: string
          brand_id: string
          email: string
          role?: string
          invited_by?: string | null
          token?: string
          status?: string
          expires_at: string
          created_at?: string | null
        }
        Update: {
          id?: string
          brand_id?: string
          email?: string
          role?: string
          invited_by?: string | null
          token?: string
          status?: string
          expires_at?: string
          created_at?: string | null
        }
        Relationships: []
      }
      credits: {
        Row: {
          id: string
          user_id: string
          amount: number
          source: string
          stripe_payment_id: string | null
          description: string | null
          expires_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          source: string
          stripe_payment_id?: string | null
          description?: string | null
          expires_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          source?: string
          stripe_payment_id?: string | null
          description?: string | null
          expires_at?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      credit_usage: {
        Row: {
          id: string
          user_id: string
          query_id: string | null
          credits_used: number
          provider: string | null
          engine: string | null
          brand_id: string | null
          description: string | null
          cost_credits: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          query_id?: string | null
          credits_used: number
          provider?: string | null
          engine?: string | null
          brand_id?: string | null
          description?: string | null
          cost_credits?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          query_id?: string | null
          credits_used?: number
          provider?: string | null
          engine?: string | null
          brand_id?: string | null
          description?: string | null
          cost_credits?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      security_logs: {
        Row: {
          id: string
          event_type: string
          user_id: string | null
          brand_id: string | null
          ip_address: string | null
          user_agent: string | null
          event_data: Json | null
          severity: string
          created_at: string | null
        }
        Insert: {
          id?: string
          event_type: string
          user_id?: string | null
          brand_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          event_data?: Json | null
          severity?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          event_type?: string
          user_id?: string | null
          brand_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          event_data?: Json | null
          severity?: string
          created_at?: string | null
        }
        Relationships: []
      }
      seo_audit_results: {
        Row: {
          id: string
          brand_id: string | null
          user_id: string
          url: string
          overall_score: number
          results: Json
          cached_at: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          brand_id?: string | null
          user_id: string
          url: string
          overall_score?: number
          results?: Json
          cached_at?: string
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          brand_id?: string | null
          user_id?: string
          url?: string
          overall_score?: number
          results?: Json
          cached_at?: string
          expires_at?: string
          created_at?: string
        }
        Relationships: []
      }
      llms_txt_versions: {
        Row: {
          id: string
          brand_id: string
          user_id: string
          llms_txt: string
          llms_full_txt: string
          input_data: Json
          version: number
          created_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          user_id: string
          llms_txt: string
          llms_full_txt: string
          input_data?: Json
          version?: number
          created_at?: string
        }
        Update: {
          id?: string
          brand_id?: string
          user_id?: string
          llms_txt?: string
          llms_full_txt?: string
          input_data?: Json
          version?: number
          created_at?: string
        }
        Relationships: []
      }
      weekly_reviews: {
        Row: {
          id: string
          brand_id: string
          user_id: string
          week_number: number
          year: number
          week_start: string
          week_end: string
          metrics: Json
          markdown: string | null
          created_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          user_id: string
          week_number: number
          year: number
          week_start: string
          week_end: string
          metrics?: Json
          markdown?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          brand_id?: string
          user_id?: string
          week_number?: number
          year?: number
          week_start?: string
          week_end?: string
          metrics?: Json
          markdown?: string | null
          created_at?: string
        }
        Relationships: []
      }
      webhook_delivery_logs: {
        Row: {
          id: string
          alert_event_id: string
          alert_rule_id: string
          url: string
          status: string
          http_status: number | null
          attempts: number
          last_attempt_at: string | null
          next_retry_at: string | null
          response_body: string | null
          error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          alert_event_id: string
          alert_rule_id: string
          url: string
          status?: string
          http_status?: number | null
          attempts?: number
          last_attempt_at?: string | null
          next_retry_at?: string | null
          response_body?: string | null
          error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          alert_event_id?: string
          alert_rule_id?: string
          url?: string
          status?: string
          http_status?: number | null
          attempts?: number
          last_attempt_at?: string | null
          next_retry_at?: string | null
          response_body?: string | null
          error?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type Tables<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Row']

export type TablesInsert<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Insert']

export type TablesUpdate<TableName extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][TableName]['Update']
