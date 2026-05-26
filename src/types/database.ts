export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      aeo_runs: {
        Row: {
          brand_id: string
          cost_credits: number
          created_at: string | null
          error: string | null
          gap_count: number
          id: string
          keyword: string
          language: string
          model: string | null
          questions_count: number
          status: string
          user_id: string
        }
        Insert: {
          brand_id: string
          cost_credits?: number
          created_at?: string | null
          error?: string | null
          gap_count?: number
          id?: string
          keyword: string
          language?: string
          model?: string | null
          questions_count?: number
          status?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          cost_credits?: number
          created_at?: string | null
          error?: string | null
          gap_count?: number
          id?: string
          keyword?: string
          language?: string
          model?: string | null
          questions_count?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'aeo_runs_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      aeo_snippets: {
        Row: {
          answer: string
          answer_model: string | null
          brand_id: string
          covered_url: string | null
          created_at: string | null
          gap_status: string | null
          id: string
          keyword: string
          language: string
          paa_snippet: string | null
          paa_source_url: string | null
          position: number | null
          question: string
          run_id: string | null
          schema_jsonld: Json | null
        }
        Insert: {
          answer: string
          answer_model?: string | null
          brand_id: string
          covered_url?: string | null
          created_at?: string | null
          gap_status?: string | null
          id?: string
          keyword: string
          language?: string
          paa_snippet?: string | null
          paa_source_url?: string | null
          position?: number | null
          question: string
          run_id?: string | null
          schema_jsonld?: Json | null
        }
        Update: {
          answer?: string
          answer_model?: string | null
          brand_id?: string
          covered_url?: string | null
          created_at?: string | null
          gap_status?: string | null
          id?: string
          keyword?: string
          language?: string
          paa_snippet?: string | null
          paa_source_url?: string | null
          position?: number | null
          question?: string
          run_id?: string | null
          schema_jsonld?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'aeo_snippets_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'aeo_snippets_run_id_fkey'
            columns: ['run_id']
            isOneToOne: false
            referencedRelation: 'aeo_runs'
            referencedColumns: ['id']
          },
        ]
      }
      ai_budgets: {
        Row: {
          alert_threshold: number
          brand_id: string | null
          created_at: string
          current_day_spend: number
          current_month_spend: number
          daily_limit_usd: number | null
          id: string
          last_alert_sent: string | null
          monthly_limit_usd: number
          provider_limits: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_threshold?: number
          brand_id?: string | null
          created_at?: string
          current_day_spend?: number
          current_month_spend?: number
          daily_limit_usd?: number | null
          id?: string
          last_alert_sent?: string | null
          monthly_limit_usd?: number
          provider_limits?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_threshold?: number
          brand_id?: string | null
          created_at?: string
          current_day_spend?: number
          current_month_spend?: number
          daily_limit_usd?: number | null
          id?: string
          last_alert_sent?: string | null
          monthly_limit_usd?: number
          provider_limits?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          agent_type: string
          brand_id: string | null
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_type?: string
          brand_id?: string | null
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_type?: string
          brand_id?: string | null
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ai_conversations_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      ai_cost_logs: {
        Row: {
          agent_type: string | null
          brand_id: string | null
          budget_alert: boolean
          cached: boolean
          conversation_id: string | null
          cost_credits: number
          cost_usd: number
          created_at: string
          endpoint: string | null
          error_message: string | null
          id: string
          input_tokens: number
          latency_ms: number | null
          model: string | null
          output_tokens: number
          provider: string
          success: boolean
          total_tokens: number
          user_id: string
        }
        Insert: {
          agent_type?: string | null
          brand_id?: string | null
          budget_alert?: boolean
          cached?: boolean
          conversation_id?: string | null
          cost_credits?: number
          cost_usd?: number
          created_at?: string
          endpoint?: string | null
          error_message?: string | null
          id?: string
          input_tokens?: number
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number
          provider: string
          success?: boolean
          total_tokens?: number
          user_id: string
        }
        Update: {
          agent_type?: string | null
          brand_id?: string | null
          budget_alert?: boolean
          cached?: boolean
          conversation_id?: string | null
          cost_credits?: number
          cost_usd?: number
          created_at?: string
          endpoint?: string | null
          error_message?: string | null
          id?: string
          input_tokens?: number
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number
          provider?: string
          success?: boolean
          total_tokens?: number
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          context_data: Json | null
          conversation_id: string
          cost_estimate: number | null
          created_at: string
          id: string
          latency_ms: number | null
          provider_used: string | null
          role: string
          tokens_used: number | null
        }
        Insert: {
          content: string
          context_data?: Json | null
          conversation_id: string
          cost_estimate?: number | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          provider_used?: string | null
          role: string
          tokens_used?: number | null
        }
        Update: {
          content?: string
          context_data?: Json | null
          conversation_id?: string
          cost_estimate?: number | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          provider_used?: string | null
          role?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'ai_messages_conversation_id_fkey'
            columns: ['conversation_id']
            isOneToOne: false
            referencedRelation: 'ai_conversations'
            referencedColumns: ['id']
          },
        ]
      }
      alert_events: {
        Row: {
          alert_rule_id: string | null
          brand_id: string
          channels_sent: string[] | null
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          alert_rule_id?: string | null
          brand_id: string
          channels_sent?: string[] | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          alert_rule_id?: string | null
          brand_id?: string
          channels_sent?: string[] | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'alert_events_alert_rule_id_fkey'
            columns: ['alert_rule_id']
            isOneToOne: false
            referencedRelation: 'alert_rules'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'alert_events_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      alert_rules: {
        Row: {
          brand_id: string
          channels: string[] | null
          condition: Json
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          last_fired_at: string | null
          name: string
          type: string
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          brand_id: string
          channels?: string[] | null
          condition: Json
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          last_fired_at?: string | null
          name: string
          type: string
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          brand_id?: string
          channels?: string[] | null
          condition?: Json
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          last_fired_at?: string | null
          name?: string
          type?: string
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'alert_rules_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      analysis_results: {
        Row: {
          brand_id: string | null
          created_at: string | null
          deleted_at: string | null
          engine: string
          id: string
          input: string
          input_mode: string
          model: string
          provider: string
          raw_response: Json | null
          recommendations: Json | null
          sentiment: string | null
          sentiment_score: number | null
          summary: string | null
          user_id: string
          visibility_score: number | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          engine: string
          id?: string
          input: string
          input_mode: string
          model: string
          provider: string
          raw_response?: Json | null
          recommendations?: Json | null
          sentiment?: string | null
          sentiment_score?: number | null
          summary?: string | null
          user_id: string
          visibility_score?: number | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          engine?: string
          id?: string
          input?: string
          input_mode?: string
          model?: string
          provider?: string
          raw_response?: Json | null
          recommendations?: Json | null
          sentiment?: string | null
          sentiment_score?: number | null
          summary?: string | null
          user_id?: string
          visibility_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'analysis_results_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          key: string | null
          key_hash: string | null
          key_prefix: string | null
          last_used_at: string | null
          name: string
          organization_id: string | null
          revoked_at: string | null
          revoked_by: string | null
          scopes: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key?: string | null
          key_hash?: string | null
          key_prefix?: string | null
          last_used_at?: string | null
          name: string
          organization_id?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          scopes?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key?: string | null
          key_hash?: string | null
          key_prefix?: string | null
          last_used_at?: string | null
          name?: string
          organization_id?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          scopes?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'api_keys_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_api_key_id: string | null
          actor_id: string
          actor_type: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json
          organization_id: string
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_api_key_id?: string | null
          actor_id: string
          actor_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          organization_id: string
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_api_key_id?: string | null
          actor_id?: string
          actor_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          organization_id?: string
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'audit_logs_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      brand_annotations: {
        Row: {
          brand_id: string
          created_at: string
          event_date: string
          id: string
          label: string
          notes: string | null
          type: string
          url: string | null
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          event_date: string
          id?: string
          label: string
          notes?: string | null
          type: string
          url?: string | null
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          event_date?: string
          id?: string
          label?: string
          notes?: string | null
          type?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'brand_annotations_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      brand_facts: {
        Row: {
          brand_id: string
          created_at: string
          fact_type: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          fact_type: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          fact_type?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: 'brand_facts_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      brand_health_scores: {
        Row: {
          avi_score: number | null
          brand_id: string
          citation_count: number | null
          citation_rate: number | null
          created_at: string | null
          date: string
          engine_breakdown: Json | null
          hallucination_rate: number | null
          health_score: number | null
          id: string
          mention_count: number | null
          mention_rate: number | null
          position_avg: number | null
          recommendation_rate: number | null
          sentiment_score: number | null
          user_id: string
          visibility_score: number | null
        }
        Insert: {
          avi_score?: number | null
          brand_id: string
          citation_count?: number | null
          citation_rate?: number | null
          created_at?: string | null
          date: string
          engine_breakdown?: Json | null
          hallucination_rate?: number | null
          health_score?: number | null
          id?: string
          mention_count?: number | null
          mention_rate?: number | null
          position_avg?: number | null
          recommendation_rate?: number | null
          sentiment_score?: number | null
          user_id: string
          visibility_score?: number | null
        }
        Update: {
          avi_score?: number | null
          brand_id?: string
          citation_count?: number | null
          citation_rate?: number | null
          created_at?: string | null
          date?: string
          engine_breakdown?: Json | null
          hallucination_rate?: number | null
          health_score?: number | null
          id?: string
          mention_count?: number | null
          mention_rate?: number | null
          position_avg?: number | null
          recommendation_rate?: number | null
          sentiment_score?: number | null
          user_id?: string
          visibility_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'brand_health_scores_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      brand_invitations: {
        Row: {
          brand_id: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          token: string
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: string
          token?: string
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: 'brand_invitations_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      brands: {
        Row: {
          aliases: string[] | null
          color: string | null
          competitors: string[] | null
          created_at: string | null
          description: string | null
          domain: string | null
          domains: string[] | null
          id: string
          industry: string | null
          is_active: boolean | null
          language: string
          logo_url: string | null
          market: string | null
          name: string
          organization_id: string | null
          report_brand_name: string | null
          report_logo_url: string | null
          report_primary_color: string | null
          slug: string
          updated_at: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          aliases?: string[] | null
          color?: string | null
          competitors?: string[] | null
          created_at?: string | null
          description?: string | null
          domain?: string | null
          domains?: string[] | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          language?: string
          logo_url?: string | null
          market?: string | null
          name: string
          organization_id?: string | null
          report_brand_name?: string | null
          report_logo_url?: string | null
          report_primary_color?: string | null
          slug: string
          updated_at?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          aliases?: string[] | null
          color?: string | null
          competitors?: string[] | null
          created_at?: string | null
          description?: string | null
          domain?: string | null
          domains?: string[] | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          language?: string
          logo_url?: string | null
          market?: string | null
          name?: string
          organization_id?: string | null
          report_brand_name?: string | null
          report_logo_url?: string | null
          report_primary_color?: string | null
          slug?: string
          updated_at?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'brands_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'brands_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
        ]
      }
      brave_api_usage: {
        Row: {
          count: number
          key_index: number
          month: string
          updated_at: string
        }
        Insert: {
          count?: number
          key_index: number
          month: string
          updated_at?: string
        }
        Update: {
          count?: number
          key_index?: number
          month?: string
          updated_at?: string
        }
        Relationships: []
      }
      citation_snapshots: {
        Row: {
          avg_position: number | null
          avg_sentiment: number | null
          avg_visibility: number | null
          brand_citations: number | null
          brand_id: string
          category: string
          citation_rate: number | null
          competitor_rates: Json | null
          created_at: string | null
          engine: string
          id: string
          language: string
          scan_date: string
          total_prompts: number | null
        }
        Insert: {
          avg_position?: number | null
          avg_sentiment?: number | null
          avg_visibility?: number | null
          brand_citations?: number | null
          brand_id: string
          category?: string
          citation_rate?: number | null
          competitor_rates?: Json | null
          created_at?: string | null
          engine?: string
          id?: string
          language?: string
          scan_date: string
          total_prompts?: number | null
        }
        Update: {
          avg_position?: number | null
          avg_sentiment?: number | null
          avg_visibility?: number | null
          brand_citations?: number | null
          brand_id?: string
          category?: string
          citation_rate?: number | null
          competitor_rates?: Json | null
          created_at?: string | null
          engine?: string
          id?: string
          language?: string
          scan_date?: string
          total_prompts?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'citation_snapshots_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
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
          user_id: string
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
        Relationships: [
          {
            foreignKeyName: 'competitor_analyses_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      credit_usage: {
        Row: {
          brand_id: string | null
          cost_credits: number | null
          created_at: string | null
          credits_used: number
          description: string | null
          engine: string | null
          id: string
          provider: string | null
          query_id: string | null
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          cost_credits?: number | null
          created_at?: string | null
          credits_used: number
          description?: string | null
          engine?: string | null
          id?: string
          provider?: string | null
          query_id?: string | null
          user_id: string
        }
        Update: {
          brand_id?: string | null
          cost_credits?: number | null
          created_at?: string | null
          credits_used?: number
          description?: string | null
          engine?: string | null
          id?: string
          provider?: string | null
          query_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      credits: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          source: string
          stripe_payment_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          source: string
          stripe_payment_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          source?: string
          stripe_payment_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      dataforseo_usage: {
        Row: {
          cost_cents: number
          count: number
          key_index: number
          month: string
          updated_at: string
        }
        Insert: {
          cost_cents?: number
          count?: number
          key_index?: number
          month: string
          updated_at?: string
        }
        Update: {
          cost_cents?: number
          count?: number
          key_index?: number
          month?: string
          updated_at?: string
        }
        Relationships: []
      }
      free_query_counters: {
        Row: {
          day: string
          used: number
          user_id: string
        }
        Insert: {
          day?: string
          used?: number
          user_id: string
        }
        Update: {
          day?: string
          used?: number
          user_id?: string
        }
        Relationships: []
      }
      gsc_performance: {
        Row: {
          brand_id: string
          clicks: number
          country: string
          ctr: number
          date: string
          device: string
          id: string
          impressions: number
          page: string | null
          position: number
          query: string | null
        }
        Insert: {
          brand_id: string
          clicks?: number
          country?: string
          ctr?: number
          date: string
          device?: string
          id?: string
          impressions?: number
          page?: string | null
          position?: number
          query?: string | null
        }
        Update: {
          brand_id?: string
          clicks?: number
          country?: string
          ctr?: number
          date?: string
          device?: string
          id?: string
          impressions?: number
          page?: string | null
          position?: number
          query?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'gsc_performance_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      keyword_rankings: {
        Row: {
          ai_overview_cited: boolean
          ai_overview_present: boolean
          brand_id: string
          created_at: string
          id: string
          intent: string | null
          keyword: string
          position: number
          search_volume: number
          url: string | null
        }
        Insert: {
          ai_overview_cited?: boolean
          ai_overview_present?: boolean
          brand_id: string
          created_at?: string
          id?: string
          intent?: string | null
          keyword: string
          position?: number
          search_volume?: number
          url?: string | null
        }
        Update: {
          ai_overview_cited?: boolean
          ai_overview_present?: boolean
          brand_id?: string
          created_at?: string
          id?: string
          intent?: string | null
          keyword?: string
          position?: number
          search_volume?: number
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'keyword_rankings_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      keyword_research: {
        Row: {
          ai_overview_present: boolean
          brand_id: string
          competition: number
          cpc: number
          created_at: string
          id: string
          intent: string | null
          keyword: string
          keyword_difficulty: number | null
          search_volume: number
          top_10_domains: Json
          trend: Json
          updated_at: string
        }
        Insert: {
          ai_overview_present?: boolean
          brand_id: string
          competition?: number
          cpc?: number
          created_at?: string
          id?: string
          intent?: string | null
          keyword: string
          keyword_difficulty?: number | null
          search_volume?: number
          top_10_domains?: Json
          trend?: Json
          updated_at?: string
        }
        Update: {
          ai_overview_present?: boolean
          brand_id?: string
          competition?: number
          cpc?: number
          created_at?: string
          id?: string
          intent?: string | null
          keyword?: string
          keyword_difficulty?: number | null
          search_volume?: number
          top_10_domains?: Json
          trend?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'keyword_research_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      keyword_tracking: {
        Row: {
          avg_position: number | null
          brand_id: string | null
          category: string | null
          cluster: string | null
          cluster_generated_at: string | null
          correlation_score: number
          created_at: string
          engines: string[]
          first_seen: string | null
          id: string
          is_active: boolean
          keyword: string
          language: string | null
          last_seen: string | null
          market: string | null
          mention_count: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avg_position?: number | null
          brand_id?: string | null
          category?: string | null
          cluster?: string | null
          cluster_generated_at?: string | null
          correlation_score?: number
          created_at?: string
          engines?: string[]
          first_seen?: string | null
          id?: string
          is_active?: boolean
          keyword: string
          language?: string | null
          last_seen?: string | null
          market?: string | null
          mention_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avg_position?: number | null
          brand_id?: string | null
          category?: string | null
          cluster?: string | null
          cluster_generated_at?: string | null
          correlation_score?: number
          created_at?: string
          engines?: string[]
          first_seen?: string | null
          id?: string
          is_active?: boolean
          keyword?: string
          language?: string | null
          last_seen?: string | null
          market?: string | null
          mention_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'keyword_tracking_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      llms_txt_versions: {
        Row: {
          brand_id: string
          created_at: string | null
          id: string
          input_data: Json | null
          llms_full_txt: string
          llms_txt: string
          user_id: string
          version: number | null
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          id?: string
          input_data?: Json | null
          llms_full_txt: string
          llms_txt: string
          user_id: string
          version?: number | null
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          id?: string
          input_data?: Json | null
          llms_full_txt?: string
          llms_txt?: string
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'llms_txt_versions_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
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
          prompt_text: string
          raw_response: Json | null
          response_comparison: Json | null
          response_text: string
          sentiment: string | null
          sentiment_aspects: Json
          sentiment_score: number | null
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
          prompt_text: string
          raw_response?: Json | null
          response_comparison?: Json | null
          response_text: string
          sentiment?: string | null
          sentiment_aspects?: Json
          sentiment_score?: number | null
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
          prompt_text?: string
          raw_response?: Json | null
          response_comparison?: Json | null
          response_text?: string
          sentiment?: string | null
          sentiment_aspects?: Json
          sentiment_score?: number | null
          user_id?: string
          visibility_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'monitoring_results_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'monitoring_results_prompt_id_fkey'
            columns: ['prompt_id']
            isOneToOne: false
            referencedRelation: 'prompts'
            referencedColumns: ['id']
          },
        ]
      }
      organization_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'organization_members_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          current_period_end: string | null
          default_workspace_id: string | null
          deleted_at: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          plan: string
          primary_color: string
          slug: string
          status: string
          stripe_customer_id: string | null
          stripe_sub_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          default_workspace_id?: string | null
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          plan?: string
          primary_color?: string
          slug: string
          status?: string
          stripe_customer_id?: string | null
          stripe_sub_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          default_workspace_id?: string | null
          deleted_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          plan?: string
          primary_color?: string
          slug?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_sub_id?: string | null
          updated_at?: string
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
      prompt_embeddings: {
        Row: {
          brand_id: string
          created_at: string
          embedding: Json
          prompt_id: string
          text: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          embedding: Json
          prompt_id: string
          text: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          embedding?: Json
          prompt_id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'prompt_embeddings_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'prompt_embeddings_prompt_id_fkey'
            columns: ['prompt_id']
            isOneToOne: true
            referencedRelation: 'prompts'
            referencedColumns: ['id']
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: 'prompts_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          last_request: number
        }
        Insert: {
          count?: number
          key: string
          last_request: number
        }
        Update: {
          count?: number
          key?: string
          last_request?: number
        }
        Relationships: []
      }
      recommendation_history: {
        Row: {
          based_on_count: number | null
          brand_id: string
          created_at: string | null
          id: string
          recommendations: Json | null
          summary: string | null
          user_id: string
        }
        Insert: {
          based_on_count?: number | null
          brand_id: string
          created_at?: string | null
          id?: string
          recommendations?: Json | null
          summary?: string | null
          user_id: string
        }
        Update: {
          based_on_count?: number | null
          brand_id?: string
          created_at?: string | null
          id?: string
          recommendations?: Json | null
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'recommendation_history_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      recommendation_tracking: {
        Row: {
          archive_id: string | null
          brand_id: string
          category: string | null
          consistency_score: number | null
          created_at: string
          first_seen_date: string | null
          id: string
          implementation_completion_date: string | null
          implementation_status: string
          last_seen_date: string | null
          notes: string | null
          occurrence_count: number
          priority: string | null
          recommendation_text: string
          source: string | null
          status: string
          updated_at: string
          user_last_updated_id: string | null
        }
        Insert: {
          archive_id?: string | null
          brand_id: string
          category?: string | null
          consistency_score?: number | null
          created_at?: string
          first_seen_date?: string | null
          id?: string
          implementation_completion_date?: string | null
          implementation_status?: string
          last_seen_date?: string | null
          notes?: string | null
          occurrence_count?: number
          priority?: string | null
          recommendation_text: string
          source?: string | null
          status?: string
          updated_at?: string
          user_last_updated_id?: string | null
        }
        Update: {
          archive_id?: string | null
          brand_id?: string
          category?: string | null
          consistency_score?: number | null
          created_at?: string
          first_seen_date?: string | null
          id?: string
          implementation_completion_date?: string | null
          implementation_status?: string
          last_seen_date?: string | null
          notes?: string | null
          occurrence_count?: number
          priority?: string | null
          recommendation_text?: string
          source?: string | null
          status?: string
          updated_at?: string
          user_last_updated_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'recommendation_tracking_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      report_deliveries: {
        Row: {
          brand_id: string
          created_at: string
          file_url: string | null
          format: string
          generated_at: string
          generated_by: string
          id: string
          language: string
          metrics_snapshot: Json
          period_end: string
          period_start: string
          score_delta: Json
          sent_at: string | null
          sent_to: string | null
          status: string
          template_id: string | null
          type: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          file_url?: string | null
          format?: string
          generated_at?: string
          generated_by: string
          id?: string
          language?: string
          metrics_snapshot?: Json
          period_end: string
          period_start: string
          score_delta?: Json
          sent_at?: string | null
          sent_to?: string | null
          status?: string
          template_id?: string | null
          type: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          file_url?: string | null
          format?: string
          generated_at?: string
          generated_by?: string
          id?: string
          language?: string
          metrics_snapshot?: Json
          period_end?: string
          period_start?: string
          score_delta?: Json
          sent_at?: string | null
          sent_to?: string | null
          status?: string
          template_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'report_deliveries_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'report_deliveries_template_id_fkey'
            columns: ['template_id']
            isOneToOne: false
            referencedRelation: 'report_templates'
            referencedColumns: ['id']
          },
        ]
      }
      report_templates: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          include_charts: boolean
          include_raw_data: boolean
          include_tables: boolean
          is_active: boolean
          language: string
          logo_url: string | null
          name: string
          primary_color: string
          sections: Json
          type: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          include_charts?: boolean
          include_raw_data?: boolean
          include_tables?: boolean
          is_active?: boolean
          language?: string
          logo_url?: string | null
          name: string
          primary_color?: string
          sections?: Json
          type: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          include_charts?: boolean
          include_raw_data?: boolean
          include_tables?: boolean
          is_active?: boolean
          language?: string
          logo_url?: string | null
          name?: string
          primary_color?: string
          sections?: Json
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'report_templates_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      response_embeddings: {
        Row: {
          brand_id: string
          created_at: string
          embedding: Json
          monitoring_result_id: string
          sentiment_score: number | null
          text: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          embedding: Json
          monitoring_result_id: string
          sentiment_score?: number | null
          text: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          embedding?: Json
          monitoring_result_id?: string
          sentiment_score?: number | null
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'response_embeddings_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'response_embeddings_monitoring_result_id_fkey'
            columns: ['monitoring_result_id']
            isOneToOne: true
            referencedRelation: 'monitoring_results'
            referencedColumns: ['id']
          },
        ]
      }
      scan_history: {
        Row: {
          brand_id: string | null
          content_type: string | null
          created_at: string | null
          engine: string
          id: string
          intent: string | null
          intent_confidence: number | null
          model: string | null
          reading_level: string | null
          source: string
          summary: string | null
          tone: string | null
          type: string
          user_id: string
          visibility_score: number | null
        }
        Insert: {
          brand_id?: string | null
          content_type?: string | null
          created_at?: string | null
          engine: string
          id?: string
          intent?: string | null
          intent_confidence?: number | null
          model?: string | null
          reading_level?: string | null
          source: string
          summary?: string | null
          tone?: string | null
          type: string
          user_id: string
          visibility_score?: number | null
        }
        Update: {
          brand_id?: string | null
          content_type?: string | null
          created_at?: string | null
          engine?: string
          id?: string
          intent?: string | null
          intent_confidence?: number | null
          model?: string | null
          reading_level?: string | null
          source?: string
          summary?: string | null
          tone?: string | null
          type?: string
          user_id?: string
          visibility_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'scan_history_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      scraper_configs: {
        Row: {
          brand_id: string
          cost_credits: number
          country: string
          created_at: string
          engine: string
          id: string
          is_active: boolean
          language: string
          last_run_at: string | null
          last_run_duration_ms: number | null
          last_run_status: string | null
          market: string
          prompt_text: string
          run_frequency: string
          success_rate: number
          updated_at: string
        }
        Insert: {
          brand_id: string
          cost_credits?: number
          country?: string
          created_at?: string
          engine: string
          id?: string
          is_active?: boolean
          language?: string
          last_run_at?: string | null
          last_run_duration_ms?: number | null
          last_run_status?: string | null
          market?: string
          prompt_text: string
          run_frequency?: string
          success_rate?: number
          updated_at?: string
        }
        Update: {
          brand_id?: string
          cost_credits?: number
          country?: string
          created_at?: string
          engine?: string
          id?: string
          is_active?: boolean
          language?: string
          last_run_at?: string | null
          last_run_duration_ms?: number | null
          last_run_status?: string | null
          market?: string
          prompt_text?: string
          run_frequency?: string
          success_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'scraper_configs_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      security_logs: {
        Row: {
          brand_id: string | null
          created_at: string
          event_data: Json
          event_type: string
          id: string
          ip_address: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          ip_address?: string | null
          severity: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          ip_address?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      seo_audit_results: {
        Row: {
          brand_id: string | null
          cached_at: string | null
          created_at: string | null
          expires_at: string
          id: string
          overall_score: number
          results: Json | null
          url: string
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          cached_at?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          overall_score: number
          results?: Json | null
          url: string
          user_id: string
        }
        Update: {
          brand_id?: string | null
          cached_at?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          overall_score?: number
          results?: Json | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'seo_audit_results_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      serp_query_cache: {
        Row: {
          created_at: string
          endpoint: string
          expires_at: string
          hit_count: number
          params: Json
          provider: string
          query_hash: string
          response: Json
        }
        Insert: {
          created_at?: string
          endpoint: string
          expires_at: string
          hit_count?: number
          params: Json
          provider: string
          query_hash: string
          response: Json
        }
        Update: {
          created_at?: string
          endpoint?: string
          expires_at?: string
          hit_count?: number
          params?: Json
          provider?: string
          query_hash?: string
          response?: Json
        }
        Relationships: []
      }
      serpapi_usage: {
        Row: {
          count: number
          key_index: number
          month: string
          updated_at: string
        }
        Insert: {
          count?: number
          key_index: number
          month: string
          updated_at?: string
        }
        Update: {
          count?: number
          key_index?: number
          month?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          id: string
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_sub_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_sub_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_sub_id?: string | null
          updated_at?: string | null
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
          invited_by: string
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
          invited_by: string
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
          invited_by?: string
          role?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'team_members_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      user_api_keys: {
        Row: {
          created_at: string | null
          encrypted_key: string
          id: string
          is_active: boolean | null
          label: string | null
          provider: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_key: string
          id?: string
          is_active?: boolean | null
          label?: string | null
          provider: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_key?: string
          id?: string
          is_active?: boolean | null
          label?: string | null
          provider?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_delivery_logs: {
        Row: {
          alert_event_id: string
          alert_rule_id: string
          attempts: number
          created_at: string
          error: string | null
          http_status: number | null
          id: string
          last_attempt_at: string | null
          next_retry_at: string | null
          response_body: string | null
          status: string
          url: string
        }
        Insert: {
          alert_event_id: string
          alert_rule_id: string
          attempts?: number
          created_at?: string
          error?: string | null
          http_status?: number | null
          id?: string
          last_attempt_at?: string | null
          next_retry_at?: string | null
          response_body?: string | null
          status?: string
          url: string
        }
        Update: {
          alert_event_id?: string
          alert_rule_id?: string
          attempts?: number
          created_at?: string
          error?: string | null
          http_status?: number | null
          id?: string
          last_attempt_at?: string | null
          next_retry_at?: string | null
          response_body?: string | null
          status?: string
          url?: string
        }
        Relationships: []
      }
      weekly_reviews: {
        Row: {
          brand_id: string
          created_at: string | null
          id: string
          markdown: string | null
          metrics: Json | null
          user_id: string
          week_end: string
          week_number: number
          week_start: string
          year: number
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          id?: string
          markdown?: string | null
          metrics?: Json | null
          user_id: string
          week_end: string
          week_number: number
          week_start: string
          year: number
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          id?: string
          markdown?: string | null
          metrics?: Json | null
          user_id?: string
          week_end?: string
          week_number?: number
          week_start?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: 'weekly_reviews_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      work_orders: {
        Row: {
          actions: Json
          baseline_geo_score: number | null
          brand_id: string
          category: string | null
          completed_at: string | null
          created_at: string
          effort: string | null
          id: string
          impact: string | null
          metadata: Json
          rationale: string | null
          recheck_delta: number | null
          recheck_geo_score: number | null
          source: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          actions?: Json
          baseline_geo_score?: number | null
          brand_id: string
          category?: string | null
          completed_at?: string | null
          created_at?: string
          effort?: string | null
          id?: string
          impact?: string | null
          metadata?: Json
          rationale?: string | null
          recheck_delta?: number | null
          recheck_geo_score?: number | null
          source?: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          actions?: Json
          baseline_geo_score?: number | null
          brand_id?: string
          category?: string | null
          completed_at?: string | null
          created_at?: string
          effort?: string | null
          id?: string
          impact?: string | null
          metadata?: Json
          rationale?: string | null
          recheck_delta?: number | null
          recheck_geo_score?: number | null
          source?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'work_orders_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
        ]
      }
      workflow_executions: {
        Row: {
          brand_id: string | null
          completed_at: string | null
          created_at: string | null
          error: string | null
          id: string
          metadata: Json | null
          prompt_id: string | null
          started_at: string | null
          status: string
          steps: Json | null
          type: string
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          metadata?: Json | null
          prompt_id?: string | null
          started_at?: string | null
          status?: string
          steps?: Json | null
          type: string
          user_id: string
        }
        Update: {
          brand_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          metadata?: Json | null
          prompt_id?: string | null
          started_at?: string | null
          status?: string
          steps?: Json | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workflow_executions_brand_id_fkey'
            columns: ['brand_id']
            isOneToOne: false
            referencedRelation: 'brands'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'workflow_executions_prompt_id_fkey'
            columns: ['prompt_id']
            isOneToOne: false
            referencedRelation: 'prompts'
            referencedColumns: ['id']
          },
        ]
      }
      workspace_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workspaces_organization_id_fkey'
            columns: ['organization_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_serp_cache: { Args: never; Returns: number }
      consume_free_query: {
        Args: { p_limit: number; p_user_id: string }
        Returns: number
      }
      deduct_credits: {
        Args: { p_amount: number; p_description: string; p_user_id: string }
        Returns: number
      }
      increment_brave_api_usage: {
        Args: { p_key_index: number; p_month: string }
        Returns: number
      }
      increment_dataforseo_usage: {
        Args: { p_cost_cents: number; p_key_index: number; p_month: string }
        Returns: number
      }
      increment_serpapi_usage: {
        Args: { p_key_index: number; p_month: string }
        Returns: number
      }
      serp_cache_register_hit: {
        Args: { p_endpoint: string; p_provider: string; p_query_hash: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { '': string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
